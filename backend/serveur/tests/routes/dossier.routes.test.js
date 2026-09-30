/**
 * Tests du routeur des dossiers (routes/dossier.js) avec Supertest.
 * Ce routeur n'est pas encore branché dans app.js : on le monte ici sur une
 * petite application Express dédiée, sous /api/dossiers.
 * La base de données est simulée : aucun PostgreSQL requis.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const query = jest.fn();
jest.unstable_mockModule('../../src/config/db.js', () => ({
  pool: { query },
}));

const { default: dossierRouter } = await import('../../src/routes/dossier.js');

const app = express();
app.use(express.json());
app.use('/api/dossiers', dossierRouter);

let consoleSpy;
beforeEach(() => {
  query.mockReset();
  consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  consoleSpy.mockRestore();
});

const dossier = { id: 1, first_name: 'Jean', last_name: 'Dupont', status: 'recherche' };

describe('GET /api/dossiers', () => {
  test('200 avec tous les dossiers', async () => {
    query.mockResolvedValue({ rows: [dossier] });

    const res = await request(app).get('/api/dossiers');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([dossier]);
    expect(query.mock.calls[0][0]).toMatch(/ORDER BY added_at DESC/);
  });

  test('500 si la base de données plante', async () => {
    query.mockRejectedValue(new Error('DB down'));

    const res = await request(app).get('/api/dossiers');

    expect(res.status).toBe(500);
  });
});

describe('GET /api/dossiers/:id', () => {
  test('200 avec le dossier demandé', async () => {
    query.mockResolvedValue({ rows: [dossier] });

    const res = await request(app).get('/api/dossiers/1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(dossier);
    expect(query.mock.calls[0][1]).toEqual(['1']);
  });

  test('404 si le dossier n\'existe pas', async () => {
    query.mockResolvedValue({ rows: [] });

    const res = await request(app).get('/api/dossiers/999');

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Dossier non trouvé');
  });

  test('500 si la base de données plante', async () => {
    query.mockRejectedValue(new Error('DB down'));

    const res = await request(app).get('/api/dossiers/1');

    expect(res.status).toBe(500);
  });
});

describe('POST /api/dossiers', () => {
  test('201 avec le dossier créé', async () => {
    query.mockResolvedValue({ rows: [dossier] });

    const res = await request(app).post('/api/dossiers').send({
      first_name: 'Jean',
      last_name: 'Dupont',
      description: 'Vu à Montréal',
      status: 'recherche',
      added_by: 3,
    });

    expect(res.status).toBe(201);
    expect(res.body.criminal).toEqual(dossier);
    expect(query.mock.calls[0][1]).toEqual(['Jean', 'Dupont', 'Vu à Montréal', 'recherche', 3]);
  });

  test('utilise le statut par défaut quand aucun statut n\'est fourni', async () => {
    query.mockResolvedValue({ rows: [dossier] });

    await request(app).post('/api/dossiers').send({ first_name: 'Jean', last_name: 'Dupont', added_by: 3 });

    // ⚠ Le code envoie 'WANTED', qui n'existe pas dans l'ENUM criminal_status
    // ('recherche', 'capture', 'libere') : avec la vraie base, ça donne une erreur 500.
    expect(query.mock.calls[0][1][3]).toBe('WANTED');
  });

  test('500 si l\'insertion échoue', async () => {
    query.mockRejectedValue(new Error('violation de contrainte'));

    const res = await request(app).post('/api/dossiers').send({ first_name: 'Jean' });

    expect(res.status).toBe(500);
  });
});

describe('PUT /api/dossiers/:id', () => {
  const body = { first_name: 'Jean', last_name: 'Dupont', description: 'maj', status: 'capture' };

  test('200 avec le dossier mis à jour', async () => {
    query.mockResolvedValue({ rowCount: 1, rows: [{ ...dossier, status: 'capture' }] });

    const res = await request(app).put('/api/dossiers/1').send(body);

    expect(res.status).toBe(200);
    expect(res.body.criminal.status).toBe('capture');
    expect(query.mock.calls[0][1]).toEqual(['Jean', 'Dupont', 'maj', 'capture', '1']);
  });

  test('404 si le dossier n\'existe pas', async () => {
    query.mockResolvedValue({ rowCount: 0, rows: [] });

    const res = await request(app).put('/api/dossiers/999').send(body);

    expect(res.status).toBe(404);
  });

  test('500 si la base de données plante', async () => {
    query.mockRejectedValue(new Error('DB down'));

    const res = await request(app).put('/api/dossiers/1').send(body);

    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/dossiers/:id/status', () => {
  test('400 si le statut est absent', async () => {
    const res = await request(app).patch('/api/dossiers/1/status').send({});

    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  test('200 avec le nouveau statut', async () => {
    query.mockResolvedValue({ rowCount: 1, rows: [{ ...dossier, status: 'libere' }] });

    const res = await request(app).patch('/api/dossiers/1/status').send({ status: 'libere' });

    expect(res.status).toBe(200);
    expect(res.body.criminal.status).toBe('libere');
    expect(query.mock.calls[0][1]).toEqual(['libere', '1']);
  });

  test('404 si le dossier n\'existe pas', async () => {
    query.mockResolvedValue({ rowCount: 0, rows: [] });

    const res = await request(app).patch('/api/dossiers/999/status').send({ status: 'capture' });

    expect(res.status).toBe(404);
  });

  test('500 si la base de données plante', async () => {
    query.mockRejectedValue(new Error('DB down'));

    const res = await request(app).patch('/api/dossiers/1/status').send({ status: 'capture' });

    expect(res.status).toBe(500);
  });
});
