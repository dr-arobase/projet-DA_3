/**
 * Tests unitaires de l'adaptateur SQLite (config/db-sqlite.js), en mémoire.
 * On vérifie qu'il répond comme pg : { rows, rowCount } et placeholders $1, $2…
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

process.env.DATABASE_URL = 'sqlite::memory:';

const { pool, closeDatabase } = await import('../../src/config/db-sqlite.js');

beforeAll(async () => {
  await pool.query('CREATE TABLE agent (id INTEGER PRIMARY KEY, nom TEXT, actif INTEGER)');
});

afterAll(async () => {
  await closeDatabase();
});

describe('adaptateur SQLite', () => {
  test('INSERT sans RETURNING renvoie rowCount', async () => {
    const result = await pool.query('INSERT INTO agent (nom, actif) VALUES ($1, $2)', ['Riahi', 1]);

    expect(result).toEqual({ rows: [], rowCount: 1 });
  });

  test('INSERT … RETURNING renvoie la ligne insérée', async () => {
    const { rows, rowCount } = await pool.query(
      'INSERT INTO agent (nom, actif) VALUES ($1, $2) RETURNING *',
      ['Tremblay', 1]
    );

    expect(rowCount).toBe(1);
    expect(rows[0]).toMatchObject({ nom: 'Tremblay', actif: 1 });
  });

  test('convertit les booléens en 0 / 1', async () => {
    await pool.query('INSERT INTO agent (nom, actif) VALUES ($1, $2)', ['Jean', false]);

    const { rows } = await pool.query('SELECT actif FROM agent WHERE nom = $1', ['Jean']);
    expect(rows[0].actif).toBe(0);
  });

  test('SELECT avec plusieurs placeholders', async () => {
    const { rows } = await pool.query(
      'SELECT nom FROM agent WHERE actif = $1 AND nom <> $2 ORDER BY nom',
      [1, 'Riahi']
    );

    expect(rows.map((r) => r.nom)).toEqual(['Tremblay']);
  });

  test('gère les placeholders dans le désordre ou répétés', async () => {
    const { rows } = await pool.query(
      'SELECT nom FROM agent WHERE nom = $2 AND actif = $1 AND nom = $2',
      [1, 'Tremblay']
    );

    expect(rows).toEqual([{ nom: 'Tremblay' }]);
  });

  test('UPDATE renvoie le nombre de lignes modifiées', async () => {
    const result = await pool.query('UPDATE agent SET actif = $1', [true]);

    expect(result.rows).toEqual([]);
    expect(result.rowCount).toBe(3);
  });

  test('connect() fournit un client avec query et release', async () => {
    const client = await pool.connect();

    const { rows } = await client.query('SELECT COUNT(*) AS n FROM agent');
    expect(rows[0].n).toBe(3);
    expect(() => client.release()).not.toThrow();
  });
});
