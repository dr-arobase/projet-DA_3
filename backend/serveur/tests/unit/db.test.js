/**
 * Tests unitaires de withTransaction (config/db.js).
 * Le pool PostgreSQL est simulé : on vérifie seulement l'ordre BEGIN / COMMIT / ROLLBACK.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

delete process.env.DATABASE_URL; // force le moteur PostgreSQL (simulé ci-dessous)

const client = { query: jest.fn(), release: jest.fn() };
const pool = { connect: jest.fn(async () => client), query: jest.fn() };

jest.unstable_mockModule('../../src/config/db-postgres.js', () => ({
  pool,
  initializeDatabase: jest.fn(),
  closeDatabase: jest.fn(),
}));

const { withTransaction } = await import('../../src/config/db.js');

beforeEach(() => {
  client.query.mockReset().mockResolvedValue({ rows: [] });
  client.release.mockReset();
});

describe('withTransaction', () => {
  test('exécute BEGIN, puis la fonction, puis COMMIT', async () => {
    const result = await withTransaction(async (c) => {
      await c.query('INSERT INTO x VALUES (1)');
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(client.query.mock.calls.map((c) => c[0])).toEqual([
      'BEGIN',
      'INSERT INTO x VALUES (1)',
      'COMMIT',
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('fait un ROLLBACK et relance l\'erreur si la fonction échoue', async () => {
    await expect(
      withTransaction(async () => {
        throw new Error('échec');
      })
    ).rejects.toThrow('échec');

    const sql = client.query.mock.calls.map((c) => c[0]);
    expect(sql).toEqual(['BEGIN', 'ROLLBACK']);
    expect(sql).not.toContain('COMMIT');
  });

  test('libère toujours la connexion, même en cas d\'erreur', async () => {
    await withTransaction(async () => {
      throw new Error('échec');
    }).catch(() => {});

    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
