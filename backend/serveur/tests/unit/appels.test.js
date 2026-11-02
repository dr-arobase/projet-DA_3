/**
 * Tests de la signalisation des appels audio et vidéo (#56) : le serveur ne relaie
 * qu'entre deux agents connectés, et seulement des messages WebRTC valides.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import {
  registerCallHandlers, nettoyerSignal, livrerAppelsEnAttente, oublierInvitations,
} from '../../src/sockets/appels.js';

const CALL = 'appel-1234-abcd';

// Socket simulé : on garde les gestionnaires pour les déclencher comme le ferait un navigateur
function socketDe(user) {
  const handlers = {};
  const autresOnglets = jest.fn();
  return {
    user,
    handlers,
    autresOnglets,
    on: (evenement, fn) => { handlers[evenement] = fn; },
    to: () => ({ emit: autresOnglets }),
  };
}

let socket;
let envoyerA;
let laisserAppelManque;
const connectes = new Set([3, 2]);

beforeEach(() => {
  socket = socketDe({ id: 3, badge_number: 'PL-003' });
  envoyerA = jest.fn();
  laisserAppelManque = jest.fn(async () => {});
  oublierInvitations(); // les invitations sont gardées d'un test à l'autre par le module
  registerCallHandlers(socket, { estConnecte: (id) => connectes.has(id), envoyerA, laisserAppelManque });
});

describe('call:invite', () => {
  test('sonne chez l\'agent appelé, avec le matricule de l\'appelant et le type d\'appel', () => {
    const ack = jest.fn();
    socket.handlers['call:invite']({ to: 2, callId: CALL, video: true }, ack);

    expect(envoyerA).toHaveBeenCalledWith(2, 'call:incoming', {
      callId: CALL, video: true, from: { id: 3, badge_number: 'PL-003' },
    });
    expect(ack).toHaveBeenCalledWith({ ok: true });
  });

  test('agent hors ligne : l\'appel attend, sans rien envoyer pour l\'instant', () => {
    const ack = jest.fn();
    socket.handlers['call:invite']({ to: 9, callId: CALL }, ack);
    expect(ack).toHaveBeenCalledWith({ ok: true, horsLigne: true });
    expect(envoyerA).not.toHaveBeenCalled();
  });

  test('s\'appeler soi-même, identifiant ou numéro d\'appel invalides : refusé', () => {
    const ack = jest.fn();
    socket.handlers['call:invite']({ to: 3, callId: CALL }, ack);
    socket.handlers['call:invite']({ to: 'abc', callId: CALL }, ack);
    socket.handlers['call:invite']({ to: 2, callId: '<script>' }, ack);
    socket.handlers['call:invite'](null, ack);
    expect(ack).toHaveBeenCalledTimes(4);
    expect(ack.mock.calls.every(([r]) => r.error)).toBe(true);
    expect(envoyerA).not.toHaveBeenCalled();
  });

  test('un appel « vidéo » qui n\'est pas exactement true devient un appel audio', () => {
    socket.handlers['call:invite']({ to: 2, callId: CALL, video: 'oui' }, jest.fn());
    expect(envoyerA.mock.calls[0][2].video).toBe(false);
  });
});

describe('réponse et fin d\'appel', () => {
  test('accepter : l\'appelant est prévenu, et les autres onglets de l\'appelé arrêtent de sonner', () => {
    socket.handlers['call:accept']({ to: 2, callId: CALL });
    expect(envoyerA).toHaveBeenCalledWith(2, 'call:accept', { callId: CALL, from: 3 });
    expect(socket.autresOnglets).toHaveBeenCalledWith('call:handled', { callId: CALL });
  });

  test('refuser parce qu\'on est déjà en appel : la raison est transmise', () => {
    socket.handlers['call:refuse']({ to: 2, callId: CALL, reason: 'occupe' });
    expect(envoyerA).toHaveBeenCalledWith(2, 'call:refuse', { callId: CALL, from: 3, reason: 'occupe' });
  });

  test('une raison inconnue devient « refuse »', () => {
    socket.handlers['call:refuse']({ to: 2, callId: CALL, reason: '<img src=x>' });
    expect(envoyerA.mock.calls[0][2].reason).toBe('refuse');
  });

  test('raccrocher prévient l\'autre agent', () => {
    socket.handlers['call:end']({ to: 2, callId: CALL });
    expect(envoyerA).toHaveBeenCalledWith(2, 'call:end', { callId: CALL, from: 3 });
  });

  test('rien n\'est relayé vers un agent déconnecté', () => {
    socket.handlers['call:end']({ to: 9, callId: CALL });
    expect(envoyerA).not.toHaveBeenCalled();
  });
});

describe('call:signal', () => {
  test('une offre valide est relayée, sans les champs en trop', () => {
    socket.handlers['call:signal']({ to: 2, callId: CALL, data: { type: 'offer', sdp: 'v=0...', pirate: 1 } });
    expect(envoyerA).toHaveBeenCalledWith(2, 'call:signal', { callId: CALL, from: 3, data: { type: 'offer', sdp: 'v=0...' } });
  });

  test('un candidat ICE valide est relayé', () => {
    const candidate = { candidate: 'candidate:1 1 udp 2122260223 10.0.0.2 54321 typ host', sdpMid: '0', sdpMLineIndex: 0 };
    socket.handlers['call:signal']({ to: 2, callId: CALL, data: { candidate } });
    expect(envoyerA.mock.calls[0][2].data).toEqual({ candidate });
  });

  test('des données invalides ou trop grosses ne sont pas relayées', () => {
    for (const data of [null, 'texte', { type: 'offer' }, { type: 'pirate', sdp: 'x' }, { type: 'offer', sdp: 'x'.repeat(20001) }, { candidate: { candidate: 42 } }]) {
      socket.handlers['call:signal']({ to: 2, callId: CALL, data });
    }
    expect(envoyerA).not.toHaveBeenCalled();
  });
});

describe('nettoyerSignal', () => {
  test('garde seulement type et sdp d\'une réponse', () => {
    expect(nettoyerSignal({ type: 'answer', sdp: 'v=0', extra: true })).toEqual({ type: 'answer', sdp: 'v=0' });
  });
});

const attendre = () => new Promise((r) => setImmediate(r));

describe('appeler un agent hors ligne', () => {
  test('il se connecte pendant que ça sonne : l\'appel lui parvient', () => {
    socket.handlers['call:invite']({ to: 9, callId: CALL, video: true }, jest.fn());
    const versNouveau = jest.fn();
    livrerAppelsEnAttente(9, versNouveau);
    expect(versNouveau).toHaveBeenCalledWith(9, 'call:incoming', {
      callId: CALL, video: true, from: { id: 3, badge_number: 'PL-003' },
    });
  });

  test('sonnerie terminée : il ne reçoit plus l\'appel en se connectant', () => {
    socket.handlers['call:invite']({ to: 9, callId: CALL }, jest.fn());
    const versNouveau = jest.fn();
    livrerAppelsEnAttente(9, versNouveau, Date.now() + 31 * 1000);
    expect(versNouveau).not.toHaveBeenCalled();
  });

  test('l\'appelant raccroche sans réponse : un « appel manqué » est laissé', async () => {
    socket.handlers['call:invite']({ to: 9, callId: CALL, video: true }, jest.fn());
    socket.handlers['call:end']({ to: 9, callId: CALL });
    await attendre();
    expect(laisserAppelManque).toHaveBeenCalledWith({ fromId: 3, toId: 9, video: true });
    livrerAppelsEnAttente(9, envoyerA);
    expect(envoyerA).not.toHaveBeenCalled(); // l'invitation est oubliée
  });
});

describe('appels manqués entre agents connectés', () => {
  test('décroché puis raccroché : pas d\'appel manqué', async () => {
    socket.handlers['call:invite']({ to: 2, callId: CALL }, jest.fn());
    socket.handlers['call:accept']({ to: 2, callId: CALL });
    socket.handlers['call:end']({ to: 2, callId: CALL });
    await attendre();
    expect(laisserAppelManque).not.toHaveBeenCalled();
  });

  test('refusé exprès : pas d\'appel manqué ; sans réponse : appel manqué', async () => {
    socket.handlers['call:invite']({ to: 2, callId: CALL }, jest.fn());
    socket.handlers['call:refuse']({ to: 2, callId: CALL, reason: 'refuse' });
    socket.handlers['call:invite']({ to: 2, callId: 'appel-5678-efgh' }, jest.fn());
    socket.handlers['call:refuse']({ to: 2, callId: 'appel-5678-efgh', reason: 'sans-reponse' });
    await attendre();
    expect(laisserAppelManque).toHaveBeenCalledTimes(1);
  });

  test('une deuxième invitation vers le même agent pendant que ça sonne est refusée', () => {
    socket.handlers['call:invite']({ to: 9, callId: CALL }, jest.fn());
    const ack = jest.fn();
    socket.handlers['call:invite']({ to: 9, callId: 'appel-5678-efgh' }, ack);
    expect(ack).toHaveBeenCalledWith({ error: 'Un appel vers cet agent est déjà en cours' });
  });

  test('un agent étranger à l\'appel ne peut pas le clore', async () => {
    socket.handlers['call:invite']({ to: 9, callId: CALL }, jest.fn());
    const intrus = socketDe({ id: 5, badge_number: 'PL-005' });
    registerCallHandlers(intrus, { estConnecte: () => true, envoyerA, laisserAppelManque });
    intrus.handlers['call:end']({ to: 9, callId: CALL });
    await attendre();
    expect(laisserAppelManque).not.toHaveBeenCalled();
  });
});
