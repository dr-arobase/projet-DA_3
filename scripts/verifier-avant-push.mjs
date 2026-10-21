/**
 * Vérifie que le projet fonctionne avant un push sur main (hook .githooks/pre-push et CI).
 *
 *   1. Lint backend
 *   2. Lint frontend
 *   3. Audit des dépendances backend
 *   4. Audit des dépendances frontend
 *   5. Tests du backend (npm test)
 *   6. Démarrage réel du serveur : il doit répondre sur / et /api-docs/
 *   7. Build du frontend (npm run build) : échoue à la moindre erreur de compilation
 *
 * Le serveur a besoin de PostgreSQL (DATABASE_URL du fichier backend/.env) :
 * s'il ne démarre pas, le push est refusé.
 *
 * Usage : node scripts/verifier-avant-push.mjs   (ou : npm run verifier)
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend = path.join(racine, 'backend');
const frontend = path.join(racine, 'frontend');
const DELAI_DEMARRAGE = 30_000;

const rouge = (t) => `\x1b[31m${t}\x1b[0m`;
const vert = (t) => `\x1b[32m${t}\x1b[0m`;
const titre = (t) => console.log(`\n\x1b[1m▶ ${t}\x1b[0m`);

function echec(message) {
  console.error(rouge(`\n✖ ${message}`));
  console.error(rouge('✖ Push refusé : corrige le problème puis relance git push.\n'));
  process.exit(1);
}

// Lance une commande npm et attend sa fin ; la sortie s'affiche en direct
function npm(args, cwd) {
  return new Promise((resolve) => {
    const enfant = spawn('npm', args, { cwd, stdio: 'inherit', shell: true });
    enfant.on('close', (code) => resolve(code === 0));
  });
}

function portLibre() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function verifierDependances(dossier, nom) {
  if (!existsSync(path.join(dossier, 'node_modules'))) {
    echec(`Les dépendances du ${nom} ne sont pas installées : lance « npm install » dans ${nom}/.`);
  }
}

async function demarrerServeur() {
  const port = await portLibre();
  const serveur = spawn(process.execPath, ['serveur/src/server.js'], {
    cwd: backend,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let sortie = '';
  const pret = new Promise((resolve, reject) => {
    const minuterie = setTimeout(() => reject(new Error(`pas de réponse après ${DELAI_DEMARRAGE / 1000} s`)), DELAI_DEMARRAGE);
    const lire = (morceau) => {
      sortie += morceau;
      if (/démarré sur/.test(sortie)) {
        clearTimeout(minuterie);
        resolve();
      }
    };
    serveur.stdout.on('data', lire);
    serveur.stderr.on('data', lire);
    serveur.on('exit', (code) => {
      clearTimeout(minuterie);
      reject(new Error(`le serveur s'est arrêté (code ${code})`));
    });
  });

  try {
    await pret;
    for (const route of ['/', '/api-docs/']) {
      const reponse = await fetch(`http://localhost:${port}${route}`);
      if (!reponse.ok) throw new Error(`GET ${route} a répondu ${reponse.status}`);
      console.log(vert(`  ✔ GET ${route} → ${reponse.status}`));
    }
  } catch (err) {
    console.error(sortie.trim());
    const indice = /ECONNREFUSED|database|connect/i.test(sortie)
      ? '\n  → PostgreSQL est-il démarré ? (ex. : docker start crimetracker-db)'
      : '';
    echec(`Le serveur ne démarre pas : ${err.message}${indice}`);
  } finally {
    serveur.removeAllListeners('exit');
    serveur.kill();
  }
}

verifierDependances(backend, 'backend');
verifierDependances(frontend, 'frontend');

titre('1/7 Lint du backend');
if (!(await npm(['run', 'lint'], backend))) echec('Le lint du backend a échoué.');

titre('2/7 Lint du frontend');
if (!(await npm(['run', 'lint'], frontend))) echec('Le lint du frontend a échoué.');

titre('3/7 Audit des dépendances backend');
if (!(await npm(['audit', '--audit-level=high'], backend))) echec('L’audit des dépendances backend a trouvé une vulnérabilité élevée ou critique.');

titre('4/7 Audit des dépendances frontend');
if (!(await npm(['audit', '--audit-level=high'], frontend))) echec('L’audit des dépendances frontend a trouvé une vulnérabilité élevée ou critique.');

titre('5/7 Tests du backend');
if (!(await npm(['test', '--', '--silent'], backend))) echec('Des tests du backend échouent.');

titre('6/7 Démarrage du serveur');
await demarrerServeur();

titre('7/7 Build du frontend');
if (!(await npm(['run', 'build'], frontend))) echec('Le frontend ne compile pas.');

console.log(vert('\n✔ Tout fonctionne : push autorisé.\n'));
