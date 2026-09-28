/**
 * Point d'entrée unique vers la base de données (PostgreSQL, voir db-postgres.js).
 * `pool.query(sql, [valeurs])` retourne { rows, rowCount }.
 */
import { pool } from './db-postgres.js';

export { pool, initializeDatabase, closeDatabase } from './db-postgres.js';

/**
 * Enveloppe des écritures qui doivent réussir ENSEMBLE. Une transaction vit
 * sur UNE connexion : on en emprunte une au pool et on la passe à fn, qui
 * doit s'en servir pour chaque requête. Si fn lève une erreur, tout est
 * annulé (ROLLBACK) ; sinon tout est confirmé (COMMIT).
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
