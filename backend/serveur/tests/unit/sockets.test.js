/**
 * Tests de Socket.IO : authentification par JWT, présence et diffusion d'événements.
 * Un vrai serveur HTTP est lancé sur un port libre, avec de vrais clients socket.io-client.
 */
import { describe, test, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import http from 'node:http';
import { io as ioClient } from 'socket.io-client';

process.env.JWT_SECRET = 'test-secret';

const { default: registerSockets, emitEvent } = await import('../../src/sockets/index.js');
const { signToken } = await import('../../src/utils/jwt.js');

let server;
let io;
let url;
const clients = [];

const connect = (token) => {
  const socket = ioClient(url, { auth: token ? { token } : {}, reconnection: false, forceNew: true });
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

  test('accepte un jeton valide et diffuse la présence', async () => {
    const socket = connect(signToken({ id: 1, badge_number: 'PL-001', role: 'policier', grade: 'lieutenant' }));
    const presence = await once(socket, 'presence:update');

    expect(presence).toEqual([{ id: 1, badge_number: 'PL-001', role: 'policier', grade: 'lieutenant' }]);
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
});
