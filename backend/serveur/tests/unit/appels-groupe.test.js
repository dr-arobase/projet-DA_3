/**
 * Tests de la signalisation des appels de groupe : seuls les membres du groupe rejoignent,
 * 6 participants au plus, et un signal ne passe qu'entre deux participants du même appel.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import {
  registerGroupCallHandlers, oublierAppelsDeGroupe, MAX_PARTICIPANTS,
} from '../../src/sockets/appels-groupe.js';

const GROUPE = 7;
const membresDuGroupe = [2, 3, 4, 5, 6, 8, 10];
const OFFRE = { type: 'offer', sdp: 'v=0 offre' };

let envoyerA;
const estMembre = jest.fn(async (groupId, userId) => groupId === GROUPE && membresDuGroupe.includes(userId));
const groupe = jest.fn(async (groupId) => (groupId === GROUPE
  ? { id: GROUPE, name: 'Patrouille nord', members: membresDuGroupe.map((id) => ({ id })) }
  : null));

// Socket simulé : on garde les gestionnaires pour les déclencher comme le ferait un navigateur
let numero = 0;
function agent(id) {
  const handlers = {};
  const socket = {
    id: `socket-${(numero += 1)}`,
    user: { id, badge_number: `PL-00${id}` },
    data: {},
    on: (evenement, fn) => { handlers[evenement] = fn; },
  };
  registerGroupCallHandlers(socket, { estMembre, groupe, envoyerA });
  // Attend la réponse (ack) ET la fin du gestionnaire (les invitations partent après la réponse)
  const appeler = async (evenement, payload) => {
    let reponse;
    await handlers[evenement](payload, (r) => { reponse = r; });
    return reponse;
  };
  return { socket, handlers, appeler };
}

const evenements = (nom) => envoyerA.mock.calls.filter(([, e]) => e === nom);

beforeEach(() => {
  oublierAppelsDeGroupe();
  envoyerA = jest.fn();
});

describe('group-call:join', () => {
  test('le premier membre lance l\'appel : les autres membres sont invités, pas lui', async () => {
    const a = agent(2);
    const reponse = await a.appeler('group-call:join', { groupId: GROUPE, video: true });

    expect(reponse).toEqual({ ok: true, participants: [] });
    const invites = evenements('group-call:started').map(([id]) => id);
    expect(invites).toEqual(membresDuGroupe.filter((id) => id !== 2));
    expect(evenements('group-call:started')[0][2]).toMatchObject({
      groupId: GROUPE, name: 'Patrouille nord', video: true, from: { id: 2, badge_number: 'PL-002' },
    });
  });

  test('le suivant reçoit la liste des participants, qui sont prévenus de son arrivée', async () => {
    await agent(2).appeler('group-call:join', { groupId: GROUPE });
    envoyerA.mockClear();

    const reponse = await agent(3).appeler('group-call:join', { groupId: GROUPE });
    expect(reponse).toEqual({ ok: true, participants: [2] });
    expect(envoyerA).toHaveBeenCalledWith(2, 'group-call:joined', { groupId: GROUPE, userId: 3 });
    expect(evenements('group-call:started')).toHaveLength(0);
  });

  test('un agent qui n\'est pas membre du groupe est refusé', async () => {
    const reponse = await agent(99).appeler('group-call:join', { groupId: GROUPE });
    expect(reponse).toEqual({ error: 'Vous n\'êtes pas membre de ce groupe' });
    expect(envoyerA).not.toHaveBeenCalled();
  });

  test('identifiant de groupe invalide : refusé', async () => {
    const reponse = await agent(2).appeler('group-call:join', { groupId: 'abc' });
    expect(reponse).toEqual({ error: 'Groupe invalide' });
  });

  test(`au-delà de ${MAX_PARTICIPANTS} participants, l'appel est complet`, async () => {
    for (const id of membresDuGroupe.slice(0, MAX_PARTICIPANTS)) {
      await agent(id).appeler('group-call:join', { groupId: GROUPE });
    }
    const reponse = await agent(membresDuGroupe[MAX_PARTICIPANTS]).appeler('group-call:join', { groupId: GROUPE });
    expect(reponse.error).toMatch(/complet/);
  });
});

describe('group-call:signal', () => {
  test('relaie une offre entre deux participants du même appel', async () => {
    const a = agent(2);
    const b = agent(3);
    await a.appeler('group-call:join', { groupId: GROUPE });
    await b.appeler('group-call:join', { groupId: GROUPE });
    envoyerA.mockClear();

    b.handlers['group-call:signal']({ groupId: GROUPE, to: 2, data: OFFRE });
    expect(envoyerA).toHaveBeenCalledWith(2, 'group-call:signal', { groupId: GROUPE, from: 3, data: OFFRE });
  });

  test('rien n\'est relayé vers un agent qui n\'est pas dans l\'appel, ni depuis un agent absent', async () => {
    const a = agent(2);
    await a.appeler('group-call:join', { groupId: GROUPE });
    envoyerA.mockClear();

    a.handlers['group-call:signal']({ groupId: GROUPE, to: 4, data: OFFRE }); // 4 n'a pas rejoint
    agent(5).handlers['group-call:signal']({ groupId: GROUPE, to: 2, data: OFFRE }); // 5 n'a pas rejoint
    expect(envoyerA).not.toHaveBeenCalled();
  });

  test('un signal invalide n\'est pas relayé', async () => {
    const a = agent(2);
    const b = agent(3);
    await a.appeler('group-call:join', { groupId: GROUPE });
    await b.appeler('group-call:join', { groupId: GROUPE });
    envoyerA.mockClear();

    b.handlers['group-call:signal']({ groupId: GROUPE, to: 2, data: { type: 'offer', sdp: 'x'.repeat(30000) } });
    b.handlers['group-call:signal']({ groupId: GROUPE, to: 2, data: '<script>' });
    expect(envoyerA).not.toHaveBeenCalled();
  });
});

describe('départ', () => {
  test('les autres participants sont prévenus; le dernier qui part termine l\'appel', async () => {
    const a = agent(2);
    const b = agent(3);
    await a.appeler('group-call:join', { groupId: GROUPE });
    await b.appeler('group-call:join', { groupId: GROUPE });
    envoyerA.mockClear();

    await b.appeler('group-call:leave', { groupId: GROUPE });
    expect(envoyerA).toHaveBeenCalledWith(2, 'group-call:left', { groupId: GROUPE, userId: 3 });
    expect(evenements('group-call:ended')).toHaveLength(0);

    await a.appeler('disconnect');
    expect(evenements('group-call:ended').map(([id]) => id)).toEqual(membresDuGroupe);
    expect(await agent(4).appeler('group-call:status', { groupId: GROUPE })).toEqual({ ok: true, participants: [] });
  });

  test('un autre onglet du même agent qui se ferme ne le fait pas partir', async () => {
    const onglet1 = agent(2);
    const onglet2 = agent(2);
    await onglet1.appeler('group-call:join', { groupId: GROUPE });
    await onglet2.appeler('disconnect');
    expect(await agent(3).appeler('group-call:status', { groupId: GROUPE })).toEqual({ ok: true, participants: [2] });
  });
});
