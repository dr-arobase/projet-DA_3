/**
 * Documentation Swagger fermée en production (#194) : avec API_DOCS=false,
 * /api-docs n'existe plus et l'accueil ne l'annonce plus.
 * La base de données est simulée : aucun PostgreSQL requis.
 */
import { jest, describe, test, expect, afterAll } from '@jest/globals';
import request from 'supertest';

jest.unstable_mockModule('../../src/config/db.js', () => ({
  pool: { query: jest.fn() },
  initializeDatabase: jest.fn(),
  closeDatabase: jest.fn(),
  withTransaction: jest.fn(),
}));

jest.unstable_mockModule('../../src/utils/account-status.js', () => ({
  isAccountActive: jest.fn(async () => true),
  getAccountAuthInfo: jest.fn(),
  publishAccountDeactivated: jest.fn(),
  listenForAccountDeactivations: jest.fn(),
}));

const avant = process.env.API_DOCS;
process.env.API_DOCS = 'false';
const { default: app } = await import('../../src/app.js');

afterAll(() => {
  if (avant === undefined) delete process.env.API_DOCS;
  else process.env.API_DOCS = avant;
});

describe('Documentation Swagger en production', () => {
  test('GET /api-docs/ répond 404 quand API_DOCS=false', async () => {
    const res = await request(app).get('/api-docs/');

    expect(res.status).toBe(404);
    expect(res.text).not.toContain('swagger-ui');
  });

  test('GET / n\'annonce plus la documentation', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'API CrimeTracker opérationnelle' });
  });
});
