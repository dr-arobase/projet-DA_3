/**
 * Tests des routes /api/users (gestion des comptes) avec Supertest.
 * La base de données est simulée : aucun PostgreSQL requis.
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

const disconnectUser = jest.fn();
jest.unstable_mockModule('../../src/sockets/index.js', () => ({
  default: jest.fn(),
  emitEvent: jest.fn(),
  emitToUsers: jest.fn(),
  disconnectUser,
}));

const isAccountActive = jest.fn(async () => true);
let authenticatedRole = 'policier';
const getAccountAuthInfo = jest.fn(async (id) => ({
  id, badge_number: 'SUP-001', role: authenticatedRole, grade: 'lieutenant', is_active: true,
}));
const publishAccountDeactivated = jest.fn();
jest.unstable_mockModule('../../src/utils/account-status.js', () => ({
  isAccountActive,
  getAccountAuthInfo,
  publishAccountDeactivated,
  listenForAccountDeactivations: jest.fn(),
}));

const { default: app } = await import('../../src/app.js');

const bearer = (role) => (authenticatedRole = role) &&
  `Bearer ${jwt.sign({ id: 1, badge_number: 'SUP-001', role, grade: 'lieutenant' }, 'test-secret')}`;

const agent = { id: 5, first_name: 'Marc', last_name: 'Roy', badge_number: 'PL-005', role: 'policier' };

beforeEach(() => {
  query.mockReset();
  disconnectUser.mockReset();
  isAccountActive.mockResolvedValue(true);
  authenticatedRole = 'policier';
  getAccountAuthInfo.mockClear();
  publishAccountDeactivated.mockReset();
});

describe('contrôle des rôles', () => {
  test('401 sans jeton', async () => {
    const res = await request(app).get('/api/users');

    expect(res.status).toBe(401);
  });

  test('403 pour un policier', async () => {
    const res = await request(app).get('/api/users').set('Authorization', bearer('policier'));

    expect(res.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  test('la promotion est réservée à la direction', async () => {
    const res = await request(app)
      .patch('/api/users/5/promote')
      .set('Authorization', bearer('superviseur'))
      .send({ role: 'superviseur', grade: 'lieutenant' });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/users', () => {
  test('liste les comptes sans le mot de passe', async () => {
    query.mockResolvedValue({ rows: [agent] });

    const res = await request(app).get('/api/users').set('Authorization', bearer('superviseur'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual([agent]);
    expect(query.mock.calls[0][0]).not.toMatch(/password_hash/);
  });

  test('GET /:id renvoie 404 si le compte n\'existe pas', async () => {
    query.mockResolvedValue({ rows: [] });

    const res = await request(app).get('/api/users/999').set('Authorization', bearer('superviseur'));

    expect(res.status).toBe(404);
  });
});

describe('POST /api/users', () => {
  const body = {
    first_name: 'Marc', last_name: 'Roy', badge_number: 'PL-005',
    email: 'marc.roy@crimetracker.local', password: 'MotDePasse1!',
  };

  test('201 : hache le mot de passe et applique le rôle / grade par défaut', async () => {
    query
      .mockResolvedValueOnce({ rows: [] }) // matricule libre
      .mockResolvedValueOnce({ rows: [agent] }); // INSERT

    const res = await request(app).post('/api/users').set('Authorization', bearer('superviseur')).send(body);

    expect(res.status).toBe(201);
    const params = query.mock.calls[1][1];
    expect(params[4]).toMatch(/^\$2[aby]\$/); // hash bcrypt, jamais le mot de passe en clair
    expect(params.slice(5)).toEqual(['policier', 'sergent_autres_fonctions']);
  });

  test('400 si un champ obligatoire manque', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', bearer('superviseur'))
      .send({ ...body, password: undefined });

    expect(res.status).toBe(400);
  });

  test('400 si le rôle est inconnu', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', bearer('superviseur'))
      .send({ ...body, role: 'admin' });

    expect(res.status).toBe(400);
  });

  test('409 si le matricule existe déjà', async () => {
    query.mockResolvedValueOnce({ rows: [agent] });

    const res = await request(app).post('/api/users').set('Authorization', bearer('superviseur')).send(body);

    expect(res.status).toBe(409);
  });
});

describe('activation, désactivation et promotion', () => {
  test('403 si un superviseur tente de désactiver son propre compte', async () => {
    const res = await request(app)
      .patch('/api/users/1/deactivate')
      .set('Authorization', bearer('superviseur'));

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: 'Vous ne pouvez pas désactiver votre propre compte.' });
    expect(query).not.toHaveBeenCalled();
    expect(disconnectUser).not.toHaveBeenCalled();
    expect(publishAccountDeactivated).not.toHaveBeenCalled();
  });

  test('403 si un superviseur tente de désactiver un compte de direction', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...agent, id: 8, role: 'direction' }] });

    const res = await request(app)
      .patch('/api/users/8/deactivate')
      .set('Authorization', bearer('superviseur'));

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      message: 'Un superviseur ne peut pas désactiver un compte de direction.',
    });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0]).toMatch(/role <> 'direction'/);
    expect(disconnectUser).not.toHaveBeenCalled();
    expect(publishAccountDeactivated).not.toHaveBeenCalled();
  });

  test.each([
    ['deactivate', 'USER_DEACTIVATED', false],
    ['reactivate', 'USER_REACTIVATED', true],
  ])('PATCH /:id/%s journalise %s', async (route, action, isActive) => {
    query
      .mockResolvedValueOnce({ rows: [{ ...agent, is_active: isActive }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] });

    const res = await request(app).patch(`/api/users/5/${route}`).set('Authorization', bearer('superviseur'));

    expect(res.status).toBe(200);
    if (isActive) {
      expect(query.mock.calls[0][1]).toEqual([isActive, '5']);
    } else {
      expect(query.mock.calls[0][1]).toEqual(['5', 'superviseur']);
      expect(query.mock.calls[0][0]).toMatch(/role <> 'direction'/);
    }
    expect(query.mock.calls[1][1].slice(0, 4)).toEqual([1, action, 'user', 5]);
    if (!isActive) {
      expect(disconnectUser).toHaveBeenCalledWith(5);
      expect(publishAccountDeactivated).toHaveBeenCalledWith(5);
    }
    else expect(disconnectUser).not.toHaveBeenCalled();
  });

  test('PATCH /:id/promote change rôle et grade (direction)', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ ...agent, role: 'superviseur' }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] });

    const res = await request(app)
      .patch('/api/users/5/promote')
      .set('Authorization', bearer('direction'))
      .send({ role: 'superviseur', grade: 'lieutenant' });

    expect(res.status).toBe(200);
    expect(query.mock.calls[1][1][1]).toBe('USER_PROMOTED');
  });

  test('PATCH /:id/promote : 400 si le grade est inconnu', async () => {
    const res = await request(app)
      .patch('/api/users/5/promote')
      .set('Authorization', bearer('direction'))
      .send({ role: 'superviseur', grade: 'general' });

    expect(res.status).toBe(400);
  });

  test('404 si le compte n\'existe pas', async () => {
    query.mockResolvedValue({ rows: [] });

    const res = await request(app).patch('/api/users/999/deactivate').set('Authorization', bearer('superviseur'));

    expect(res.status).toBe(404);
  });
});
