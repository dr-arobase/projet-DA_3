/**
 * Intergiciel validateId : tout identifiant de l'URL doit être un entier positif.
 * La base de données est simulée : une requête invalide ne doit jamais l'atteindre.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret';

const query = jest.fn();
jest.unstable_mockModule('../../src/config/db.js', () => ({
  pool: { query },
  initializeDatabase: jest.fn(),
  closeDatabase: jest.fn(),
  withTransaction: jest.fn(),
}));

jest.unstable_mockModule('../../src/sockets/index.js', () => ({
  default: jest.fn(),
  emitEvent: jest.fn(),
  emitToUsers: jest.fn(),
}));

const { default: app } = await import('../../src/app.js');
const { validateId } = await import('../../src/middleware/validateId.middleware.js');

const bearer = `Bearer ${jwt.sign({ id: 1, badge_number: 'DIR-001', role: 'direction', grade: 'directeur_general' }, 'test-secret')}`;

beforeEach(() => {
  query.mockReset();
});

describe('validateId (unitaire)', () => {
  const run = (value) => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    validateId({}, res, next, value, 'id');
    return { res, next };
  };

  test.each(['1', '42', '2147483647'])('laisse passer %s', (value) => {
    const { res, next } = run(value);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test.each(['abc', '0', '-1', '1.5', '01', '1e3', ' 1', '2147483648', '99999999999999999999'])(
    'refuse %p avec 400', (value) => {
      const { res, next } = run(value);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].message).toMatch(/id doit être un entier positif/);
    });
});

describe('toutes les routes avec un identifiant refusent un id non numérique', () => {
  test.each([
    ['get', '/api/criminals/abc'],
    ['put', '/api/criminals/abc'],
    ['delete', '/api/criminals/abc'],
    ['patch', '/api/criminals/abc/status'],
    ['patch', '/api/criminals/abc/address'],
    ['get', '/api/users/abc'],
    ['patch', '/api/users/abc/deactivate'],
    ['patch', '/api/users/abc/reactivate'],
    ['patch', '/api/users/abc/promote'],
    ['get', '/api/messages/abc'],
    ['get', '/api/messages/groups/abc'],
    ['post', '/api/messages/groups/abc/messages'],
    ['post', '/api/messages/groups/abc/members'],
    ['delete', '/api/messages/groups/abc/members/5'],
    ['delete', '/api/messages/groups/5/members/abc'],
    ['get', '/api/criminals/0'],
    ['get', '/api/users/-3'],
    ['get', '/api/criminals/1.5'],
    ['get', '/api/criminals/99999999999'],
  ])('%s %s → 400 sans toucher à la base', async (method, url) => {
    const res = await request(app)[method](url).set('Authorization', bearer).send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Identifiant invalide/);
    expect(query).not.toHaveBeenCalled();
  });

  test('sans jeton, on reçoit 401 avant la validation de l\'id', async () => {
    const res = await request(app).get('/api/criminals/abc');

    expect(res.status).toBe(401);
  });

  test('un id valide passe jusqu\'au contrôleur', async () => {
    query.mockResolvedValue({ rows: [] });

    const res = await request(app).get('/api/users/5').set('Authorization', bearer);

    expect(res.status).toBe(404); // le compte n'existe pas, mais la requête a atteint la base
    expect(query).toHaveBeenCalled();
  });

  test('les routes sans identifiant ne sont pas touchées', async () => {
    query.mockResolvedValue({ rows: [] });

    const res = await request(app).get('/api/messages/contacts').set('Authorization', bearer);

    expect(res.status).not.toBe(400);
  });
});