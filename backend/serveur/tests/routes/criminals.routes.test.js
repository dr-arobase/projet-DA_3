/**
 * Tests des routes /api/criminals avec Supertest.
 * La base de données est simulée : aucun PostgreSQL requis.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';

const query = jest.fn();
jest.unstable_mockModule('../../src/config/db.js', () => ({
  pool: { query },
  initializeDatabase: jest.fn(),
  closeDatabase: jest.fn(),
  withTransaction: jest.fn(),
}));

const { default: app } = await import('../../src/app.js');

beforeEach(() => {
  query.mockReset();
});

const rows = [
  { id: 2, first_name: 'Marc', last_name: 'Roy', status: 'recherche', photo_url: null },
  { id: 1, first_name: 'Jean', last_name: 'Dupont', status: 'capture', photo_url: null },
];

describe('GET /api/criminals', () => {
  test('200 avec la page 1 et 10 résultats par défaut', async () => {
    query.mockResolvedValue({ rows });

    const res = await request(app).get('/api/criminals');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ page: 1, data: rows });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/FROM criminal/);
    expect(sql).toMatch(/ORDER BY added_at DESC/);
    expect(params).toEqual([10, 0]); // LIMIT 10 OFFSET 0
  });

  test('calcule l\'OFFSET à partir de page et limit', async () => {
    query.mockResolvedValue({ rows: [] });

    const res = await request(app).get('/api/criminals?page=3&limit=5');

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(3);
    expect(query.mock.calls[0][1]).toEqual([5, 10]);
  });

  test('revient aux valeurs par défaut si page / limit ne sont pas des nombres', async () => {
    query.mockResolvedValue({ rows: [] });

    const res = await request(app).get('/api/criminals?page=abc&limit=xyz');

    expect(res.body.page).toBe(1);
    expect(query.mock.calls[0][1]).toEqual([10, 0]);
  });

  test('ne sélectionne que les colonnes publiques de la liste', async () => {
    query.mockResolvedValue({ rows: [] });

    await request(app).get('/api/criminals');

    const [sql] = query.mock.calls[0];
    expect(sql).toMatch(/SELECT id, first_name, last_name, status, photo_url FROM criminal/);
  });

  test('500 si la base de données plante', async () => {
    query.mockRejectedValue(new Error('DB down'));

    const res = await request(app).get('/api/criminals');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Erreur serveur');
  });
});

describe('POST /api/criminals', () => {
  // La création n'est pas encore implémentée (TODO dans routes/criminals.js).
  test('répond 201 avec le message temporaire, sans toucher à la base', async () => {
    const res = await request(app)
      .post('/api/criminals')
      .send({ first_name: 'Jean', last_name: 'Dupont', added_by: 1 });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Création à implémenter');
    expect(query).not.toHaveBeenCalled();
  });
});
