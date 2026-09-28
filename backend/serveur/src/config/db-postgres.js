/**
 * La connexion à PostgreSQL.
 */
import pg from 'pg';

const { Pool, types } = pg;

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://crimetracker:crimetracker@localhost:5432/crimetracker';

// Conversion des BIGINT
types.setTypeParser(types.builtins.INT8, Number);

export const pool = new Pool({ connectionString: DATABASE_URL });

/** Vérifie que les tables existent (idempotent), puis insère les données initiales si vide. */
export async function initializeDatabase() {
  // On tente d'exécuter le schéma ; s'il existe déjà on ignore l'erreur
  try {
    await pool.query(await readSql('schema.sql'));
  } catch (err) {
    // Code 42710 = type déjà existant, 42P07 = table déjà existante : c'est normal
    if (err.code !== '42710' && err.code !== '42P07') throw err;
  }

  const { rows } = await pool.query('SELECT COUNT(*) AS n FROM app_user');
  if (rows[0].n === 0) {
    await pool.query(await readSql('seed.sql'));

    // S'assurer que les séquences sont à jour après l'insertion initiale
    await pool.query(`
      SELECT setval(pg_get_serial_sequence('app_user', 'id'), (SELECT MAX(id) FROM app_user));
      SELECT setval(pg_get_serial_sequence('criminal', 'id'), (SELECT MAX(id) FROM criminal));
      SELECT setval(pg_get_serial_sequence('sighting', 'id'), (SELECT MAX(id) FROM sighting));
      SELECT setval(pg_get_serial_sequence('alert', 'id'), (SELECT MAX(id) FROM alert));
    `);
  }
}

async function readSql(name) {
  const { readFile } = await import('node:fs/promises');
  return readFile(new URL(`../../database/${name}`, import.meta.url), 'utf8');
}

/** Ferme les connexions */
export function closeDatabase() {
  return pool.end();
}
