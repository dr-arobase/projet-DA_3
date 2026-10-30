/**
 * Inventaire des permissions : chaque route protégée a un test de refus.
 *
 *   - sans jeton            → 401 (toutes les routes protégées)
 *   - jeton invalide        → 403 (toutes les routes protégées)
 *   - compte désactivé      → 401 (toutes les routes protégées)
 *   - rôle insuffisant      → 403 (routes réservées à un rôle)
 *   - rôle suffisant        → la requête passe le contrôle d'accès (ni 401 ni 403)
 *
 * Le rôle vient du compte en base (getAccountAuthInfo), pas du jeton : on le simule ici.
 * Aucun refus ne doit atteindre les données (pool.query).
 * Hiérarchie des rôles : policier < superviseur < direction (rbac.middleware.js).
 * Les refus métier (membre d'un groupe, superviseur qui crée un superviseur...)
 * sont testés dans groups.routes.test.js et users.routes.test.js.
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

// Compte de l'agent connecté, tel que le lit verifyToken en base
let compte = { role: 'policier', is_active: true };
jest.unstable_mockModule('../../src/utils/account-status.js', () => ({
  getAccountAuthInfo: jest.fn(async (id) => ({
    id, badge_number: 'AG-001', grade: 'lieutenant', ...compte,
  })),
  isAccountActive: jest.fn(async () => compte.is_active),
  publishAccountDeactivated: jest.fn(),
  listenForAccountDeactivations: jest.fn(),
}));

jest.unstable_mockModule('../../src/sockets/index.js', () => ({
  default: jest.fn(),
  emitEvent: jest.fn(),
  emitToUsers: jest.fn(),
  disconnectUser: jest.fn(),
}));

jest.unstable_mockModule('../../src/services/geocoding.service.js', () => ({
  geocode: jest.fn(),
  geocodeOrNull: jest.fn(async () => null),
}));

const { default: app } = await import('../../src/app.js');

const ROLES = ['policier', 'superviseur', 'direction'];
const JETON = `Bearer ${jwt.sign({ id: 1, badge_number: 'AG-001' }, 'test-secret')}`;
const connecte = (role, is_active = true) => {
  compte = { role, is_active };
  return JETON;
};

// [méthode, adresse, rôle minimal] — null : tout agent connecté
// Les routes /api/users visent le compte 5 : l'agent connecté (id 1) ne peut pas se désactiver lui-même (403 voulu)
const ROUTES = [
  // Compte de l'agent connecté
  ['get', '/api/auth/me', null],
  ['post', '/api/auth/logout', null],
  ['post', '/api/auth/change-password', null],
  ['put', '/api/auth/avatar', null],
  ['delete', '/api/auth/avatar', null],
  ['get', '/api/uploads/avatars/1-1.png', null],
  // Registre des dossiers
  ['get', '/api/criminals', null],
  ['get', '/api/criminals/1', null],
  ['post', '/api/criminals', null],
  ['patch', '/api/criminals/1/status', null],
  ['patch', '/api/criminals/1/address', null],
  ['put', '/api/criminals/1', 'superviseur'],
  ['delete', '/api/criminals/1', 'superviseur'],
  ['get', '/api/geocode?q=Montreal', null],
  // Terrain
  ['post', '/api/sightings', null],
  ['get', '/api/sightings/recent', null],
  ['get', '/api/sightings?criminal_id=1', 'superviseur'],
  // Alertes
  ['get', '/api/alerts', null],
  ['post', '/api/alerts', 'superviseur'],
  // Comptes
  ['get', '/api/users', 'superviseur'],
  ['get', '/api/users/5', 'superviseur'],
  ['post', '/api/users', 'superviseur'],
  ['patch', '/api/users/5/deactivate', 'superviseur'],
  ['patch', '/api/users/5/reactivate', 'superviseur'],
  ['patch', '/api/users/5/promote', 'direction'],
  // Journal d'audit
  ['get', '/api/audit-logs', 'direction'],
  // Messagerie privée
  ['get', '/api/messages/contacts', null],
  ['get', '/api/messages/unread', null],
  ['get', '/api/messages/1', null],
  ['post', '/api/messages', null],
  ['patch', '/api/messages/1', null],
  ['delete', '/api/messages/1', null],
  ['post', '/api/messages/attachments', null],
  ['get', '/api/messages/1/attachment', null],
  // Groupes
  ['get', '/api/messages/groups', null],
  ['post', '/api/messages/groups', null],
  ['get', '/api/messages/groups/1', null],
  ['post', '/api/messages/groups/1/messages', null],
  ['post', '/api/messages/groups/1/members', null],
  ['delete', '/api/messages/groups/1/members/2', null],
];

const send = (method, url, auth) => {
  const req = request(app)[method](url);
  if (auth) req.set('Authorization', auth);
  return method === 'get' || method === 'delete' ? req : req.send({});
};

const rank = (role) => ROLES.indexOf(role);
// Rôles refusés / acceptés pour chaque route réservée
const denied = ROUTES.filter(([, , min]) => min)
  .flatMap(([m, url, min]) => ROLES.filter((r) => rank(r) < rank(min)).map((r) => [m, url, r, min]));
const allowed = ROUTES.filter(([, , min]) => min)
  .flatMap(([m, url, min]) => ROLES.filter((r) => rank(r) >= rank(min)).map((r) => [m, url, r]));

beforeEach(() => {
  query.mockReset();
  query.mockResolvedValue({ rows: [], rowCount: 0 });
});

describe('sans jeton : 401', () => {
  test.each(ROUTES)('%s %s', async (method, url) => {
    const res = await send(method, url);

    expect(res.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('jeton invalide : 403', () => {
  test.each(ROUTES)('%s %s', async (method, url) => {
    const res = await send(method, url, 'Bearer faux-jeton');

    expect(res.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('compte désactivé : 401, même avec un jeton encore valide', () => {
  test.each(ROUTES)('%s %s', async (method, url) => {
    const res = await send(method, url, connecte('direction', false));

    expect(res.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('rôle insuffisant : 403', () => {
  test.each(denied)('%s %s refusé à un %s (réservé : %s)', async (method, url, role) => {
    const res = await send(method, url, connecte(role));

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/rôle insuffisant/);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('rôle suffisant : le contrôle d\'accès laisse passer', () => {
  test.each(allowed)('%s %s accepté pour un %s', async (method, url, role) => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await send(method, url, connecte(role));

    // La requête peut échouer plus loin (400 corps vide, 404 introuvable...), mais pas sur les droits
    expect([401, 403]).not.toContain(res.status);
    console.error.mockRestore();
  });
});
