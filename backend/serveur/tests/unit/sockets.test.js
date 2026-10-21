/**
 * Tests de Socket.IO : authentification par JWT, présence et diffusion d'événements.
 * Un vrai serveur HTTP est lancé sur un port libre, avec de vrais clients socket.io-client.
 */
import { jest, describe, test, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import http from 'node:http';
import { io as ioClient } from 'socket.io-client';

process.env.JWT_SECRET = 'test-secret';
process.env.SOCKET_ALLOWED_ORIGINS = 'http://localhost:5173,http://localhost:8080';

const inactiveUsers = new Set();
const query = jest.fn(async (_sql, [id]) => ({
  rows: [{
    id: Number(id),
    badge_number: `PL-${String(id).padStart(3, '0')}`,
    role: 'policier',
    grade: 'sergent',
    is_active: !inactiveUsers.has(Number(id)),
  }],
}));
jest.unstable_mockModule('../../src/config/db.js', () => ({
  pool: { query },
}));

const { default: registerSockets, emitEvent, disconnectUser } = await import('../../src/sockets/index.js');
const { signToken } = await import('../../src/utils/jwt.js');

let server;
let io;
let url;
const clients = [];

const connect = (token, origin) => {
  const socket = ioClient(url, {
    auth: token ? { token } : {},
    reconnection: false,
    forceNew: true,
    ...(origin ? { extraHeaders: { Origin: origin } } : {}),
  });
  clients.push(socket);
  return socket;
};

const once = (socket, event) => new Promise((resolve) => socket.once(event, resolve));

beforeAll(async () => {
  server = http.createServer();
  io = registerSockets(server);
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});

// Attend que le serveur ait traité les déconnexions : sinon un agent du test
// précédent peut encore figurer dans la présence du test suivant.
afterEach(async () => {
  clients.splice(0).forEach((s) => s.disconnect());
  while (io.of('/').sockets.size > 0) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  inactiveUsers.clear();
});

afterAll(async () => {
  await new Promise((resolve) => io.close(resolve));
});

describe('Socket.IO', () => {
  test('refuse une connexion sans jeton', async () => {
    const err = await once(connect(), 'connect_error');

    expect(err.message).toBe('Authentification Socket.IO échouée');
  });

  test('refuse un jeton invalide', async () => {
    const err = await once(connect('faux'), 'connect_error');

    expect(err.message).toBe('Authentification Socket.IO échouée');
  });

  test('refuse un jeton encore valide si le compte a été désactivé', async () => {
    inactiveUsers.add(7);
    const err = await once(connect(signToken({ id: 7, role: 'policier' })), 'connect_error');

    expect(err.message).toBe('Authentification Socket.IO échouée');
  });

  test('accepte un jeton valide et diffuse la présence', async () => {
    const socket = connect(
      signToken({ id: 1, badge_number: 'PL-001', role: 'policier', grade: 'lieutenant' }),
      'http://localhost:5173'
    );
    const presence = await once(socket, 'presence:update');

    expect(presence).toEqual([{ id: 1, badge_number: 'PL-001', role: 'policier', grade: 'sergent' }]);
  });

  test('refuse une origine navigateur qui ne figure pas dans la liste autorisée', async () => {
    const err = await once(
      connect(signToken({ id: 1, role: 'policier' }), 'https://site-malveillant.example'),
      'connect_error'
    );

    expect(err.message).toBe('Authentification Socket.IO échouée');
  });

  test('utilise les informations courantes de la base, pas le rôle du jeton', async () => {
    const socket = connect(signToken({
      id: 1, badge_number: 'ANCIEN-001', role: 'direction', grade: 'general',
    }));
    const presence = await once(socket, 'presence:update');

    expect(presence).toEqual([{ id: 1, badge_number: 'PL-001', role: 'policier', grade: 'sergent' }]);
  });

  test('accepte le cookie de session du navigateur', async () => {
    const token = signToken({ id: 9, badge_number: 'PL-009', role: 'policier' });
    const socket = ioClient(url, {
      reconnection: false, forceNew: true,
      extraHeaders: { Cookie: `crimetracker_session=${token}` },
    });
    clients.push(socket);

    const presence = await once(socket, 'presence:update');
    expect(presence.map((u) => u.id)).toEqual([9]);
  });

  test('emitEvent diffuse à tous les clients connectés', async () => {
    const a = connect(signToken({ id: 1, badge_number: 'PL-001', role: 'policier' }));
    const b = connect(signToken({ id: 2, badge_number: 'PL-002', role: 'policier' }));
    await Promise.all([once(a, 'connect'), once(b, 'connect')]);

    const received = Promise.all([once(a, 'criminal:added'), once(b, 'criminal:added')]);
    emitEvent('criminal:added', { id: 42 });

    expect(await received).toEqual([{ id: 42 }, { id: 42 }]);
  });

  test('met à jour la présence quand un agent se déconnecte', async () => {
    const a = connect(signToken({ id: 1, badge_number: 'PL-001', role: 'policier' }));
    await once(a, 'connect');
    const b = connect(signToken({ id: 2, badge_number: 'PL-002', role: 'policier' }));
    await once(b, 'connect');

    const afterLeave = once(a, 'presence:update');
    b.disconnect();

    expect((await afterLeave).map((u) => u.id)).toEqual([1]);
  });

  test('déconnecte tous les onglets d’un agent désactivé', async () => {
    const socket = connect(signToken({ id: 12, badge_number: 'PL-012', role: 'policier' }));
    await once(socket, 'connect');
    const disconnected = once(socket, 'disconnect');

    disconnectUser(12);

    expect(await disconnected).toBe('io server disconnect');
  });
});
