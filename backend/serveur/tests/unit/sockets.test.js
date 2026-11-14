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

const {
  default: registerSockets, emitEvent, disconnectUser, PING_INTERVAL, PING_TIMEOUT, DELAI_MAX_DISPARITION,
} = await import('../../src/sockets/index.js');
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

// Ping court pour le serveur de test : une connexion muette est détectée en moins d'une seconde
const PING_TEST = { pingInterval: 300, pingTimeout: 200 };

const jetonDe = (id) => signToken({ id, role: 'policier' });

// Prochaine liste de présence qui vérifie la condition (les autres sont ignorées)
const presenceOu = (socket, condition) => new Promise((resolve) => {
  const ecouter = (liste) => {
    if (!condition(liste)) return;
    socket.off('presence:update', ecouter);
    resolve(liste);
  };
  socket.on('presence:update', ecouter);
});
const ids = (liste) => liste.map((u) => u.id).sort((a, b) => a - b);

// Attend que le serveur ait traité les connexions et déconnexions
const attendreConnexionsServeur = async (nombre) => {
  while (io.of('/').sockets.size !== nombre) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

beforeAll(async () => {
  server = http.createServer();
  io = registerSockets(server, PING_TEST);
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
    const afterJoin = once(a, 'presence:update');
    const b = connect(signToken({ id: 2, badge_number: 'PL-002', role: 'policier' }));
    await once(b, 'connect');
    expect((await afterJoin).map((u) => u.id)).toEqual([1, 2]);

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

// Récit R6 (#206) : une présence fiable
describe('Présence fiable (#206)', () => {
  test('plusieurs onglets du même agent comptent pour une seule présence', async () => {
    const observateur = connect(jetonDe(2));
    await presenceOu(observateur, (l) => ids(l).includes(2));

    const onglet1 = connect(jetonDe(1));
    const onglet2 = connect(jetonDe(1));
    const onglet3 = connect(jetonDe(1));
    await Promise.all([onglet1, onglet2, onglet3].map((s) => once(s, 'presence:update')));
    await attendreConnexionsServeur(4);

    const nouveau = connect(jetonDe(3));
    const liste = await presenceOu(nouveau, (l) => ids(l).includes(3));
    expect(ids(liste)).toEqual([1, 2, 3]);
  });

  test('fermer un onglet parmi plusieurs garde l’agent en ligne, sans diffusion inutile', async () => {
    const observateur = connect(jetonDe(2));
    await presenceOu(observateur, (l) => ids(l).includes(2));
    const onglet1 = connect(jetonDe(1));
    const onglet2 = connect(jetonDe(1));
    await presenceOu(observateur, (l) => ids(l).includes(1));
    await attendreConnexionsServeur(3);

    const recues = [];
    observateur.on('presence:update', (l) => recues.push(ids(l)));
    onglet1.disconnect();
    await attendreConnexionsServeur(2);

    const nouveau = connect(jetonDe(3));
    expect(ids(await presenceOu(nouveau, (l) => ids(l).includes(3)))).toEqual([1, 2, 3]);
    // L'observateur n'a reçu que l'arrivée de l'agent 3, pas un faux départ de l'agent 1
    expect(recues).toEqual([[1, 2, 3]]);
    expect(onglet2.connected).toBe(true);
  });

  test('fermer le dernier onglet retire l’agent tout de suite', async () => {
    const observateur = connect(jetonDe(2));
    await presenceOu(observateur, (l) => ids(l).includes(2));
    const onglet1 = connect(jetonDe(1));
    const onglet2 = connect(jetonDe(1));
    await presenceOu(observateur, (l) => ids(l).includes(1));
    await attendreConnexionsServeur(3);

    const depart = presenceOu(observateur, (l) => !ids(l).includes(1));
    onglet1.disconnect();
    onglet2.disconnect();

    expect(ids(await depart)).toEqual([2]);
  });

  test('connexion coupée sans au revoir (onglet planté, réseau perdu) : l’agent disparaît au délai de ping', async () => {
    const observateur = connect(jetonDe(2));
    await presenceOu(observateur, (l) => ids(l).includes(2));
    const agent = connect(jetonDe(1));
    await presenceOu(observateur, (l) => ids(l).includes(1));

    // L'agent ne répond plus aux pings du serveur, sans fermer la connexion :
    // c'est ce que voit le serveur quand le navigateur plante ou que le réseau tombe.
    const engine = agent.io.engine;
    const envoyer = engine._sendPacket.bind(engine);
    engine._sendPacket = (type, ...reste) => (type === 'pong' ? undefined : envoyer(type, ...reste));

    const debut = Date.now();
    const liste = await presenceOu(observateur, (l) => !ids(l).includes(1));
    const duree = Date.now() - debut;

    expect(ids(liste)).toEqual([2]);
    expect(duree).toBeLessThan(PING_TEST.pingInterval + 2 * PING_TEST.pingTimeout + 500);
  });

  test('en production, un agent disparu est retiré en moins de 30 secondes', () => {
    expect(DELAI_MAX_DISPARITION).toBe(PING_INTERVAL + 2 * PING_TIMEOUT);
    expect(DELAI_MAX_DISPARITION).toBeLessThan(30_000);
    // Les réglages passés à registerSockets sont bien ceux du serveur
    expect(io.engine.opts.pingInterval).toBe(PING_TEST.pingInterval);
    expect(io.engine.opts.pingTimeout).toBe(PING_TEST.pingTimeout);
  });
});