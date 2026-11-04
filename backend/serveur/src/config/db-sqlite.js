/**
 * Adaptateur SQLite EN MÉMOIRE, réservé aux tests automatisés : DATABASE_URL=sqlite::memory:
 *
 * Ce n'est PAS une base pour faire tourner l'application (#87) : schema.sql et les requêtes
 * des modèles sont écrits pour PostgreSQL (types ENUM, SERIAL, json_agg, ILIKE…).
 * Pour développer sans installer PostgreSQL : docker compose up -d postgres.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const target = process.env.DATABASE_URL?.slice('sqlite:'.length) || 'crimetracker.sqlite';
const dbPath = target === ':memory:' ? target : fileURLToPath(new URL(`../../${target}`, import.meta.url));

if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);

// Les lecteurs (un autre processus) ne bloquent pas le serveur.
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

/** Exécute une requête écrite pour pg et répond comme pg. */
async function query(sql, params = []) {
  // $1, $2… deviennent des « ? » anonymes ; on range les valeurs dans l'ordre
  // où les placeholders apparaissent (un même $n peut revenir plusieurs fois).
  const order = [];
  const statement = db.prepare(sql.replace(/\$(\d+)/g, (_, n) => {
    order.push(Number(n) - 1);
    return '?';
  }));
  const values = order
    .map((i) => params[i])
    .map((v) => (typeof v === 'boolean' ? Number(v) : v));

  if (/^\s*(SELECT|WITH)\b/i.test(sql) || /\bRETURNING\b/i.test(sql)) {
    const rows = statement.all(...values);
    return { rows, rowCount: rows.length };
  }
  const { changes } = statement.run(...values);
  return { rows: [], rowCount: changes };
}

// SQLite n'a qu'une connexion : « l'emprunter » revient à la rendre telle quelle.
export const pool = {
  query,
  async connect() {
    return { query, release() {} };
  },
};

/** Refuse de démarrer l'application sur SQLite, avec la marche à suivre (#87). */
export async function initializeDatabase() {
  throw new Error(
    'SQLite ne sert qu\'aux tests : l\'application exige PostgreSQL. '
    + 'Lancez « docker compose up -d postgres » puis retirez DATABASE_URL=sqlite:… du fichier .env.'
  );
}

/** Ferme le fichier. */
export async function closeDatabase() {
  db.close();
}
