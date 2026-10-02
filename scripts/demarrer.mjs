/**
 * Démarre tout le projet en développement, d'une seule commande :
 *
 *   1. Installe les dépendances du backend et du frontend si elles manquent
 *   2. Démarre la base PostgreSQL dans Docker (docker compose up -d postgres)
 *   3. Lance le backend (nodemon, port 3000) et le frontend (Vite, port 5173) côte à côte
 *
 * Ctrl+C arrête les deux. Si l'un s'arrête, l'autre est arrêté aussi.
 *
 * Usage : npm run dev   (depuis la racine, ou le bouton ▷ à côté du script dans package.json)
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { connect } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const windows = process.platform === 'win32';

const couleur = (code) => (t) => `\x1b[${code}m${t}\x1b[0m`;
const gras = couleur(1);
const jaune = couleur(33);
const rouge = couleur(31);

const applications = [
  { nom: 'backend', dossier: path.join(racine, 'backend'), teinte: couleur(36), port: 3000 },
  { nom: 'frontend', dossier: path.join(racine, 'frontend'), teinte: couleur(35), port: 5173 },
];

function etape(texte) {
  console.log(gras(`\n▶ ${texte}`));
}

// Un serveur répond-il déjà sur ce port ? (ex. un autre terminal où le projet tourne encore)
function portOccupe(port) {
  return new Promise((resolve) => {
    const socket = connect({ port, host: 'localhost' });
    socket.setTimeout(1000);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(false));
  });
}

// 0. Ports libres ? Sinon Vite prendrait un autre port en silence et le backend planterait.
const occupes = [];
for (const { nom, port } of applications) {
  if (await portOccupe(port)) occupes.push(`${nom} (port ${port})`);
}
if (occupes.length) {
  console.error(rouge(`✖ Déjà utilisé : ${occupes.join(', ')}.`));
  console.error(rouge('  Le projet tourne sans doute déjà dans un autre terminal : ferme-le (Ctrl+C) puis relance « npm run dev ».'));
  process.exit(1);
}

// 1. Dépendances
for (const { nom, dossier } of applications) {
  if (existsSync(path.join(dossier, 'node_modules'))) continue;
  etape(`Installation des dépendances du ${nom}…`);
  const { status } = spawnSync('npm', ['install'], { cwd: dossier, stdio: 'inherit', shell: true });
  if (status !== 0) {
    console.error(rouge(`✖ npm install a échoué dans ${nom}/`));
    process.exit(1);
  }
}

// 2. Base de données (facultatif : on continue si Docker n'est pas là, la base peut être locale)
etape('Démarrage de PostgreSQL (Docker)…');
const docker = spawnSync('docker', ['compose', 'up', '-d', '--wait', 'postgres'], {
  cwd: racine,
  stdio: 'inherit',
  shell: true,
});
if (docker.status !== 0) {
  console.warn(jaune('⚠ Docker indisponible ou base non démarrée : le backend utilisera la base de backend/.env.'));
  console.warn(jaune('  Lance Docker Desktop puis relance « npm run dev » si le backend n\'arrive pas à se connecter.'));
}

// 3. Backend + frontend en parallèle, sortie préfixée par le nom de chaque application
etape('Démarrage du backend et du frontend… (Ctrl+C pour tout arrêter)');
console.log(`  Application : ${gras('http://localhost:5173')}`);
console.log(`  API         : http://localhost:3000   (documentation : /api-docs)\n`);

let enArret = false;
const largeur = Math.max(...applications.map((a) => a.nom.length));
const enfants = applications.map(({ nom, dossier, teinte }) => {
  const enfant = spawn('npm', ['run', 'dev'], {
    cwd: dossier,
    shell: true,
    // Hors Windows : un groupe de processus à part, pour pouvoir arrêter npm ET ses enfants
    detached: !windows,
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  const prefixe = teinte(`[${nom.padEnd(largeur)}]`);
  const reste = { stdout: '', stderr: '' };
  for (const flux of ['stdout', 'stderr']) {
    enfant[flux].on('data', (morceau) => {
      const lignes = (reste[flux] + morceau).split(/\r?\n/);
      reste[flux] = lignes.pop();
      for (const ligne of lignes) process[flux].write(`${prefixe} ${ligne}\n`);
    });
  }

  enfant.on('exit', (code) => {
    if (!enArret) {
      console.error(rouge(`\n✖ Le ${nom} s'est arrêté (code ${code}) : arrêt de l'autre application.`));
      arreter(code || 1);
    }
  });
  return enfant;
});

function arreter(code = 0) {
  if (enArret) return;
  enArret = true;
  for (const enfant of enfants) {
    if (enfant.exitCode !== null) continue;
    if (windows) {
      // /T : tout l'arbre (npm -> node -> vite / nodemon)
      spawnSync('taskkill', ['/pid', String(enfant.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      try { process.kill(-enfant.pid, 'SIGTERM'); } catch { /* déjà arrêté */ }
    }
  }
  process.exit(code);
}

process.on('SIGINT', () => arreter(0));
process.on('SIGTERM', () => arreter(0));
