/**
 * Tests de l'application Express (app.js) : accueil, Swagger, 404, erreurs.
 * La base de données est simulée : aucun PostgreSQL requis.
 */
import { jest, describe, test, expect } from '@jest/globals';
import request from 'supertest';

jest.unstable_mockModule('../../src/config/db.js', () => ({
  pool: { query: jest.fn() },
  initializeDatabase: jest.fn(),
  closeDatabase: jest.fn(),
  withTransaction: jest.fn(),
}));

const { default: app } = await import('../../src/app.js');

describe('Application Express', () => {
  test('GET / renvoie le message d\'accueil en JSON', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({
      message: 'API CrimeTracker opérationnelle',
      documentation: '/api-docs',
    });
  });

  test('GET /api-docs/ sert l\'interface Swagger', async () => {
    const res = await request(app).get('/api-docs/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });

  test('le fichier swagger.json est un document OpenAPI valide', async () => {
    const { readFile } = await import('node:fs/promises');
    const doc = JSON.parse(await readFile(new URL('../../src/swagger.json', import.meta.url), 'utf8'));

    expect(doc.openapi ?? doc.swagger).toBeDefined();
    expect(doc.paths).toBeDefined();
  });

  test('une route inconnue renvoie 404', async () => {
    const res = await request(app).get('/api/nexiste-pas');

    expect(res.status).toBe(404);
  });

  test('un JSON mal formé est intercepté par errorHandler (400)', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"badge_number": ');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
    spy.mockRestore();
  });
});
