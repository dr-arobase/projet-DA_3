/**
 * La connexion à PostgreSQL.
 */
import pg from 'pg';
import { readFile } from 'node:fs/promises';

const { Pool, types } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://crimetracker:crimetracker@localhost:5432/crimetracker';

// COUNT(*) retourne un BIGINT : on le lit comme un nombre JavaScript.
types.setTypeParser(types.builtins.INT8, Number);
// Une colonne DATE reste une chaîne « AAAA-MM-JJ » (pas de décalage de fuseau horaire).
types.setTypeParser(types.builtins.DATE, (value) => value);

export const pool = new Pool({ connectionString: DATABASE_URL });

/**
 * Crée les tables au premier démarrage (schema.sql), puis charge les données
 * de démonstration (seed.sql) si aucun compte n'existe. Sans effet ensuite :
 * les données survivent aux redémarrages.
 */
export async function initializeDatabase() {
  const { rows: tables } = await pool.query("SELECT to_regclass('public.app_user') AS name");
  if (tables[0].name === null) {
    await pool.query(await readSql('schema.sql'));
  }

  const { rows } = await pool.query('SELECT COUNT(*) AS n FROM app_user');
  if (rows[0].n === 0) {
    await pool.query(await readSql('seed.sql'));
  }
}

function readSql(name) {
  return readFile(new URL(`../../database/${name}`, import.meta.url), 'utf8');
}

/** Ferme les connexions. */
export function closeDatabase() {
  return pool.end();
}
