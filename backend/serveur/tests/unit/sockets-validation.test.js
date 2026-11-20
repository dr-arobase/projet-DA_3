/**
 * FC4 : chaque événement reçu par Socket.IO est vérifié (type, longueur, identifiants) avant usage.
 * Un test par événement : des données mal formées ne sont ni relayées ni enregistrées,
 * et l'événement qui a une réponse (ack) répond par une erreur.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { registerCallHandlers, oublierInvitations, MAX_INVITATIONS } from '../../src/sockets/appels.js';
import { registerGroupCallHandlers, oublierAppelsDeGroupe } from '../../src/sockets/appels-groupe.js';
import { lireId, lireObjet, lireCallId, nettoyerSignal, MAX_SDP, MAX_CANDIDAT } from '../../src/sockets/valider.js';

const CALL = 'appel-1234-abcd';
const GROUPE = 7;
const OFFRE = { type: 'offer', sdp: 'v=0 offre' };

// Données mal formées qu'un navigateur modifié peut envoyer à la place d'un objet
const PAS_UN_OBJET = [null, undefined, 'texte', 42, true, [CALL], [{ callId: CALL, to: 2 }]];
// Identifiants mal formés : Number() seul en acceptait plusieurs (true → 1, [2] → 2, "0x10" → 16)
const MAUVAIS_IDS = [true, [2], '0x10', '1e1', ' 2 ', '2abc', 1.5, 0, -2, 2147483648, { id: 2 }, null, ''];

function socketDe(user) {
  const handlers = {};
  return {
    id: `socket-${user.id}`,
    user,
    data: {},
    handlers,
    on: (evenement, fn) => { handlers[evenement] = fn; },
    to: () => ({ emit: jest.fn() }),
  };
}

let socket;
let envoyerA;
let laisserAppelManque;
const connectes = new Set([2, 3, 4, 5, 6, 8]);
const estMembre = jest.fn(async (groupId, userId) => groupId === GROUPE && [2, 3, 4].includes(userId));
const groupe = jest.fn(async (groupId) => (groupId === GROUPE
  ? { id: GROUPE, name: 'Patrouille', members: [{ id: 2 }, { id: 3 }, { id: 4 }] }
  : null));

beforeEach(() => {
  oublierInvitations();
  oublierAppelsDeGroupe();
  envoyerA = jest.fn();
  laisserAppelManque = jest.fn(async () => {});
  estMembre.mockClear();
  socket = socketDe({ id: 3, badge_number: 'PL-003' });
  registerCallHandlers(socket, { estConnecte: (id) => connectes.has(id), envoyerA, laisserAppelManque });
  registerGroupCallHandlers(socket, { estMembre, groupe, envoyerA });
});

// Déclenche un événement et rend la réponse (ack), s'il y en a une
async function emettre(evenement, payload) {
  let reponse;
  await socket.handlers[evenement](payload, (r) => { reponse = r; });
  return reponse;
}

describe('valider.js', () => {
  test('lireId : seulement un entier positif, en nombre ou en chiffres', () => {
    expect(lireId(2)).toBe(2);
    expect(lireId('2')).toBe(2);
    expect(lireId(2147483647)).toBe(2147483647);
    for (const id of MAUVAIS_IDS) expect(lireId(id)).toBeNull();
  });

  test('lireObjet : un objet simple, pas un tableau, une chaîne ou null', () => {
    expect(lireObjet({ a: 1 })).toEqual({ a: 1 });
    for (const valeur of PAS_UN_OBJET) expect(lireObjet(valeur)).toBeNull();
  });

  test('lireCallId : 8 à 64 lettres, chiffres, _ ou -', () => {
    expect(lireCallId(CALL)).toBe(CALL);
    for (const id of ['court', 'x'.repeat(65), 'appel 1234', 'appel<script>', 12345678, [CALL]]) {
      expect(lireCallId(id)).toBeNull();
    }
  });

  test('nettoyerSignal : taille et forme d\'une offre ou d\'un candidat ICE', () => {
    expect(nettoyerSignal(OFFRE)).toEqual(OFFRE);
    expect(nettoyerSignal({ type: 'offer', sdp: 'x'.repeat(MAX_SDP + 1) })).toBeNull();
    expect(nettoyerSignal({ type: 'offer', sdp: 42 })).toBeNull();
    expect(nettoyerSignal([OFFRE])).toBeNull();
    expect(nettoyerSignal({ candidate: { candidate: 'x'.repeat(MAX_CANDIDAT + 1) } })).toBeNull();
    expect(nettoyerSignal({ candidate: ['candidate:1'] })).toBeNull();
    // Index de ligne hors bornes : gardé vide plutôt que relayé tel quel
    expect(nettoyerSignal({ candidate: { candidate: 'c', sdpMid: '0', sdpMLineIndex: 99999 } }))
      .toEqual({ candidate: { candidate: 'c', sdpMid: '0', sdpMLineIndex: null } });
  });
});

describe('appels à deux', () => {
  test('call:invite : données ou destinataire mal formés refusés, rien ne sonne', async () => {
    for (const payload of PAS_UN_OBJET) {
      expect(await emettre('call:invite', payload)).toEqual({ error: 'Appel invalide' });
    }
    for (const to of MAUVAIS_IDS) {
      expect(await emettre('call:invite', { callId: CALL, to })).toEqual({ error: 'Appel invalide' });
    }
    expect(await emettre('call:invite', { callId: 'court', to: 2 })).toEqual({ error: 'Appel invalide' });
    expect(envoyerA).not.toHaveBeenCalled();
  });

  test(`call:invite : au plus ${MAX_INVITATIONS} appels qui sonnent en même temps`, async () => {
    const agents = [2, 4, 5, 6, 8];
    const reponses = [];
    for (const [n, to] of agents.entries()) {
      reponses.push(await emettre('call:invite', { callId: `appel-rafale-${n}`, to }));
    }
    expect(reponses.slice(0, MAX_INVITATIONS)).toEqual(Array(MAX_INVITATIONS).fill({ ok: true }));
    expect(reponses[MAX_INVITATIONS]).toEqual({ error: `Au plus ${MAX_INVITATIONS} appels peuvent sonner en même temps` });
    expect(envoyerA).toHaveBeenCalledTimes(MAX_INVITATIONS);
  });

  test.each(['call:accept', 'call:refuse', 'call:end'])('%s : données ou destinataire mal formés ne sont pas relayés', async (evenement) => {
    for (const payload of PAS_UN_OBJET) await emettre(evenement, payload);
    for (const to of MAUVAIS_IDS) await emettre(evenement, { callId: CALL, to });
    await emettre(evenement, { callId: 'x'.repeat(65), to: 2 });
    expect(envoyerA).not.toHaveBeenCalled();
  });

  test('call:refuse : une raison qui n\'est pas connue devient « refuse »', async () => {
    await emettre('call:refuse', { callId: CALL, to: 2, reason: { piege: true } });
    expect(envoyerA).toHaveBeenCalledWith(2, 'call:refuse', { callId: CALL, from: 3, reason: 'refuse' });
  });

  test('call:signal : données, destinataire ou signal mal formés ne sont pas relayés', async () => {
    for (const payload of PAS_UN_OBJET) await emettre('call:signal', payload);
    for (const to of MAUVAIS_IDS) await emettre('call:signal', { callId: CALL, to, data: OFFRE });
    for (const data of [null, 'offre', [OFFRE], { type: 'offer', sdp: 'x'.repeat(MAX_SDP + 1) }]) {
      await emettre('call:signal', { callId: CALL, to: 2, data });
    }
    expect(envoyerA).not.toHaveBeenCalled();
  });
});

describe('appels de groupe', () => {
  test.each(['group-call:join', 'group-call:status'])('%s : données ou groupe mal formés refusés, sans lire la base', async (evenement) => {
    for (const payload of PAS_UN_OBJET) {
      expect(await emettre(evenement, payload)).toEqual({ error: 'Groupe invalide' });
    }
    for (const groupId of MAUVAIS_IDS) {
      expect(await emettre(evenement, { groupId })).toEqual({ error: 'Groupe invalide' });
    }
    expect(estMembre).not.toHaveBeenCalled();
    expect(envoyerA).not.toHaveBeenCalled();
  });

  test('group-call:signal : rien n\'est relayé avec des données, un groupe, un destinataire ou un signal mal formés', async () => {
    expect(await emettre('group-call:join', { groupId: GROUPE })).toEqual({ ok: true, participants: [] });
    envoyerA.mockClear();

    for (const payload of PAS_UN_OBJET) await emettre('group-call:signal', payload);
    for (const id of MAUVAIS_IDS) {
      await emettre('group-call:signal', { groupId: id, to: 2, data: OFFRE });
      await emettre('group-call:signal', { groupId: GROUPE, to: id, data: OFFRE });
    }
    await emettre('group-call:signal', { groupId: GROUPE, to: 2, data: [OFFRE] });
    expect(envoyerA).not.toHaveBeenCalled();
  });

  test('group-call:leave : des données mal formées ne font partir personne', async () => {
    await emettre('group-call:join', { groupId: GROUPE });
    for (const payload of [...PAS_UN_OBJET, { groupId: [GROUPE] }, { groupId: `${GROUPE}.0` }]) {
      await emettre('group-call:leave', payload);
    }
    expect(await emettre('group-call:status', { groupId: GROUPE })).toEqual({ ok: true, participants: [3] });
  });
});
