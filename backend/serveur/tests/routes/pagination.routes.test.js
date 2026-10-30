/**
 * Pagination des listes : dossiers, alertes et journal d'audit.
 * page négative ou invalide → 1 ; limit plafonnée à 100.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret';

const query = jest.fn();
const authenticatedRole = 'direction';
jest.unstable_mockModule('../../src/config/db.js', () => ({
  pool: { query },
  initializeDatabase: jest.fn(),
  closeDatabase: jest.fn(),
  withTransaction: jest.fn(),
}));

jest.unstable_mockModule('../../src/utils/account-status.js', () => ({
  getAccountAuthInfo: jest.fn(async (id) => ({
    id, badge_number: 'DIR-001', role: authenticatedRole, grade: 'directeur_general', is_active: true,
  })),
  isAccountActive: jest.fn(async () => true),
  publishAccountDeactivated: jest.fn(),
  listenForAccountDeactivations: jest.fn(),
}));

const disconnectUser = jest.fn();
jest.unstable_mockModule('../../src/sockets/index.js', () => ({
  default: jest.fn(),
  emitEvent: jest.fn(),
  emitToUsers: jest.fn(),
  disconnectUser,
}));

const { default: app } = await import('../../src/app.js');
const { readPagination, MAX_LIMIT } = await import('../../src/utils/pagination.js');

const bearer = `Bearer ${jwt.sign({ id: 1, badge_number: 'DIR-001', role: 'direction', grade: 'directeur_general' }, 'test-secret')}`;

// Répond 0 au COUNT(*) et une liste vide au reste
beforeEach(() => {
  query.mockReset();
  query.mockImplementation(async (sql) => (sql.includes('COUNT(*)') ? { rows: [{ count: '0' }] } : { rows: [] }));
});

// Paramètres [LIMIT, OFFSET] de la requête de liste (pas celle du COUNT)
const limitOffset = () => query.mock.calls.find(([sql]) => !sql.includes('COUNT(*)'))[1].slice(-2);

describe('readPagination (unitaire)', () => {
  test.each([
    [{}, { page: 1, limit: 20, offset: 0 }],
    [{ page: '3' }, { page: 3, limit: 20, offset: 40 }],
    [{ page: '-3' }, { page: 1, limit: 20, offset: 0 }],
    [{ page: '0' }, { page: 1, limit: 20, offset: 0 }],
    [{ page: 'abc' }, { page: 1, limit: 20, offset: 0 }],
    [{ limit: '100000' }, { page: 1, limit: MAX_LIMIT, offset: 0 }],
    [{ limit: '-5' }, { page: 1, limit: 1, offset: 0 }],
    [{ page: '2', limit: '50' }, { page: 2, limit: 50, offset: 50 }],
  ])('%p → %p', (q, attendu) => {
    expect(readPagination(q, 20)).toEqual(attendu);
  });
});

describe.each([
  ['/api/alerts', 20],
  ['/api/audit-logs', 20],
  ['/api/criminals', 10],
])('pagination de %s', (url, parDefaut) => {
  test(`limite par défaut : ${parDefaut}`, async () => {
    const res = await request(app).get(url).set('Authorization', bearer);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, limit: parDefaut });
    expect(limitOffset()).toEqual([parDefaut, 0]);
  });

  test('limit plafonnée à 100', async () => {
    const res = await request(app).get(`${url}?limit=100000`).set('Authorization', bearer);

    expect(res.body.limit).toBe(100);
    expect(limitOffset()).toEqual([100, 0]);
  });

  test('une page négative revient à la page 1 (jamais d\'OFFSET négatif)', async () => {
    const res = await request(app).get(`${url}?page=-3`).set('Authorization', bearer);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(limitOffset()[1]).toBe(0);
  });

  test('calcule l\'OFFSET', async () => {
    await request(app).get(`${url}?page=3&limit=5`).set('Authorization', bearer);

    expect(limitOffset()).toEqual([5, 10]);
  });
});