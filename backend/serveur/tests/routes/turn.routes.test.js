/**
 * Relais TURN des appels : GET /api/turn donne les serveurs ICE avec des identifiants temporaires.
 * La base est simulée : aucun PostgreSQL requis.
 */
import crypto from 'node:crypto';
import { jest, describe, test, expect, afterEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret';

jest.unstable_mockModule('../../src/config/db.js', () => ({
  pool: { query: jest.fn() },
  initializeDatabase: jest.fn(),
  closeDatabase: jest.fn(),
  withTransaction: jest.fn(),
}));

jest.unstable_mockModule('../../src/sockets/index.js', () => ({
  default: jest.fn(),
  emitEvent: jest.fn(),
  emitToUsers: jest.fn(),
  disconnectUser: jest.fn(),
}));

jest.unstable_mockModule('../../src/utils/account-status.js', () => ({
  isAccountActive: jest.fn(async () => true),
  getAccountAuthInfo: jest.fn(async (id) => ({
    id, badge_number: 'PL-003', role: 'policier', grade: 'sergent_autres_fonctions', is_active: true,
  })),
  publishAccountDeactivated: jest.fn(),
  listenForAccountDeactivations: jest.fn(),
}));

const { default: app } = await import('../../src/app.js');
const { serveursIce } = await import('../../src/routes/turn.routes.js');

const bearer = `Bearer ${jwt.sign({ id: 3, badge_number: 'PL-003', role: 'policier' }, 'test-secret')}`;

afterEach(() => {
  delete process.env.TURN_URLS;
  delete process.env.TURN_SECRET;
});

describe('GET /api/turn', () => {
  test('refusé sans connexion', async () => {
    const res = await request(app).get('/api/turn');
    expect(res.status).toBe(401);
  });

  test('sans TURN configuré : STUN seulement', async () => {
    const res = await request(app).get('/api/turn').set('Authorization', bearer);
    expect(res.status).toBe(200);
    expect(res.body.iceServers).toEqual([{ urls: 'stun:stun.l.google.com:19302' }]);
  });

  test('avec TURN configuré : identifiants temporaires signés avec le secret', async () => {
    process.env.TURN_URLS = 'turn:exemple.ca:3478?transport=udp, turn:exemple.ca:3478?transport=tcp';
    process.env.TURN_SECRET = 'secret-turn';

    const res = await request(app).get('/api/turn').set('Authorization', bearer);

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    const turn = res.body.iceServers[1];
    expect(turn.urls).toEqual(['turn:exemple.ca:3478?transport=udp', 'turn:exemple.ca:3478?transport=tcp']);
    const [expiration, id] = turn.username.split(':');
    expect(id).toBe('3');
    expect(Number(expiration)).toBeGreaterThan(Date.now() / 1000);
    expect(turn.credential).toBe(crypto.createHmac('sha1', 'secret-turn').update(turn.username).digest('base64'));
  });
});

describe('serveursIce', () => {
  test('les identifiants expirent 12 h plus tard', () => {
    const [, turn] = serveursIce(7, { urls: 'turn:x:3478', secret: 's', maintenant: 1_000_000_000_000 });
    expect(turn.username).toBe(`${1_000_000_000 + 12 * 3600}:7`);
  });

  test('URL sans secret : pas de TURN', () => {
    expect(serveursIce(7, { urls: 'turn:x:3478', secret: '' })).toHaveLength(1);
  });
});
