/**
 * Tests des groupes de la messagerie (#55) : création, lecture, envoi, membres.
 * Surtout les refus : non-membre (403), non-créateur (403), agents invalides (400).
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
  // La transaction passe les requêtes au même faux client
  withTransaction: jest.fn(async (fn) => fn({ query })),
}));

const emitToUsers = jest.fn();
jest.unstable_mockModule('../../src/sockets/index.js', () => ({
  default: jest.fn(),
  emitEvent: jest.fn(),
  emitToUsers,
}));

const { default: app } = await import('../../src/app.js');

const session = (id) => `Bearer ${jwt.sign({ id, role: 'policier' }, 'test-secret')}`;
const MOI = 3;

const membre = (id) => ({ id, first_name: `Prénom${id}`, last_name: `Nom${id}`, badge_number: `PL-00${id}` });
// Groupe 7 créé par l'agent 2, avec les membres 2, 3 et 4
const groupe = (extra = {}) => ({
  id: 7, name: 'Patrouille nord', created_by: 2, created_at: '2026-10-15T10:00:00Z',
  members: [membre(2), membre(3), membre(4)], ...extra,
});

// Base simulée : chaque requête est reconnue à son texte
function base({ g = groupe(), actifs = null } = {}) {
  query.mockImplementation(async (sql, params) => {
    if (sql.includes('FROM message_group g WHERE g.id')) return { rows: g ? [g] : [] };
    if (sql.includes('FROM app_user WHERE id = ANY')) {
      return { rows: (actifs ?? params[0]).map((id) => ({ id })) };
    }
    if (sql.includes('INSERT INTO message_group (name')) return { rows: [{ id: 7 }] };
    if (sql.includes('INSERT INTO message_group_member')) return { rows: params[1].map((user_id) => ({ user_id })) };
    if (sql.includes('UPDATE message_group_member SET last_read_at')) return { rows: [], rowCount: 1 };
    if (sql.includes('WHERE m.group_id = $1')) return { rows: [{ id: 1, group_id: 7, sender_id: 2, body: 'Salut' }] };
    if (sql.includes('INSERT INTO message (sender_id, group_id')) {
      return { rows: [{ id: 9, sender_id: params[0], group_id: params[1], body: params[2] }] };
    }
    if (sql.includes('DELETE FROM message_group_member')) return { rows: [], rowCount: 1 };
    if (sql.includes('UPDATE message_group SET created_by')) return { rows: [{ created_by: 4 }] };
    if (sql.includes('FROM message_group g') && sql.includes('JOIN message_group_member gm')) return { rows: [groupe()] };
    throw new Error(`Requête inattendue : ${sql}`);
  });
}

const requetes = (fragment) => query.mock.calls.filter(([sql]) => sql.includes(fragment));

beforeEach(() => {
  query.mockReset();
  emitToUsers.mockReset();
});

describe('accès', () => {
  test('401 sans session', async () => {
    const res = await request(app).get('/api/messages/groups');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/messages/groups', () => {
  test('liste les groupes de l\'agent connecté seulement', async () => {
    base();
    const res = await request(app).get('/api/messages/groups').set('Authorization', session(MOI));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(requetes('JOIN message_group_member gm')[0][1]).toEqual([MOI]);
  });
});

describe('POST /api/messages/groups', () => {
  const creer = (corps) => request(app).post('/api/messages/groups').set('Authorization', session(MOI)).send(corps);

  test('201 : crée le groupe, le créateur en est membre, les membres sont prévenus', async () => {
    base();
    const res = await creer({ name: '  Patrouille nord ', member_ids: [2, 4, 4, MOI] });

    expect(res.status).toBe(201);
    expect(requetes('INSERT INTO message_group (name')[0][1]).toEqual(['Patrouille nord', MOI]);
    // Créateur en premier, doublons et soi-même retirés de la liste choisie
    expect(requetes('INSERT INTO message_group_member')[0][1]).toEqual([7, [MOI, 2, 4]]);
    expect(emitToUsers).toHaveBeenCalledWith([2, 3, 4], 'group:updated', { group_id: 7 });
  });

  test('400 sans nom', async () => {
    const res = await creer({ name: '  ', member_ids: [2] });
    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  test('400 si le nom est trop long', async () => {
    const res = await creer({ name: 'x'.repeat(101), member_ids: [2] });
    expect(res.status).toBe(400);
  });

  test('400 sans autre membre que soi', async () => {
    const res = await creer({ name: 'Seul', member_ids: [MOI] });
    expect(res.status).toBe(400);
  });

  test('400 si member_ids n\'est pas une liste d\'identifiants', async () => {
    expect((await creer({ name: 'G', member_ids: '2' })).status).toBe(400);
    expect((await creer({ name: 'G', member_ids: [2, 'abc'] })).status).toBe(400);
  });

  test('400 si un agent choisi est désactivé ou n\'existe pas', async () => {
    base({ actifs: [2] });
    const res = await creer({ name: 'G', member_ids: [2, 99] });

    expect(res.status).toBe(400);
    expect(requetes('INSERT INTO message_group')).toHaveLength(0);
  });
});

describe('GET /api/messages/groups/:groupId', () => {
  test('un membre lit les messages, et ils passent à « lus » pour lui', async () => {
    base();
    const res = await request(app).get('/api/messages/groups/7').set('Authorization', session(MOI));

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect(requetes('SET last_read_at')[0][1]).toEqual([7, MOI]);
    // La pastille du menu baisse dans tous ses onglets
    expect(emitToUsers).toHaveBeenCalledWith([MOI], 'messages:lus', {});
  });

  test('403 pour un agent qui n\'est pas membre, même en appelant l\'API à la main', async () => {
    base();
    const res = await request(app).get('/api/messages/groups/7').set('Authorization', session(5));

    expect(res.status).toBe(403);
    expect(requetes('WHERE m.group_id = $1')).toHaveLength(0);
  });

  test('404 si le groupe n\'existe pas', async () => {
    base({ g: null });
    const res = await request(app).get('/api/messages/groups/7').set('Authorization', session(MOI));
    expect(res.status).toBe(404);
  });

  test('400 si l\'identifiant n\'est pas un nombre', async () => {
    const res = await request(app).get('/api/messages/groups/abc').set('Authorization', session(MOI));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/messages/groups/:groupId/messages', () => {
  const envoyer = (id, corps) =>
    request(app).post('/api/messages/groups/7/messages').set('Authorization', session(id)).send(corps);

  test('201 : le message est enregistré et poussé à tous les membres', async () => {
    base();
    const res = await envoyer(MOI, { body: ' 10-4 ' });

    expect(res.status).toBe(201);
    expect(requetes('INSERT INTO message (sender_id, group_id')[0][1]).toEqual([MOI, 7, '10-4']);
    expect(emitToUsers).toHaveBeenCalledWith([2, 3, 4], 'group:message', expect.objectContaining({ id: 9 }));
  });

  test('403 pour un non-membre : rien n\'est enregistré', async () => {
    base();
    const res = await envoyer(5, { body: 'Intrus' });

    expect(res.status).toBe(403);
    expect(requetes('INSERT INTO message')).toHaveLength(0);
  });

  test('400 si le message est vide ou trop long', async () => {
    expect((await envoyer(MOI, { body: '  ' })).status).toBe(400);
    expect((await envoyer(MOI, { body: 'x'.repeat(2001) })).status).toBe(400);
  });
});

describe('POST /api/messages/groups/:groupId/members', () => {
  const ajouter = (id, corps) =>
    request(app).post('/api/messages/groups/7/members').set('Authorization', session(id)).send(corps);

  test('le créateur ajoute un membre', async () => {
    base();
    const res = await ajouter(2, { member_ids: [5] });

    expect(res.status).toBe(200);
    expect(requetes('INSERT INTO message_group_member')[0][1]).toEqual([7, [5]]);
  });

  test('403 pour un membre qui n\'est pas le créateur', async () => {
    base();
    const res = await ajouter(MOI, { member_ids: [5] });

    expect(res.status).toBe(403);
    expect(requetes('INSERT INTO message_group_member')).toHaveLength(0);
  });

  test('403 pour un non-membre', async () => {
    base();
    expect((await ajouter(5, { member_ids: [6] })).status).toBe(403);
  });
});

describe('DELETE /api/messages/groups/:groupId/members/:userId', () => {
  const retirer = (id, cible) =>
    request(app).delete(`/api/messages/groups/7/members/${cible}`).set('Authorization', session(id));

  test('un membre quitte le groupe', async () => {
    base();
    const res = await retirer(MOI, MOI);

    expect(res.status).toBe(200);
    expect(requetes('DELETE FROM message_group_member')[0][1]).toEqual([7, MOI]);
    expect(requetes('UPDATE message_group SET created_by')).toHaveLength(0);
    // Celui qui part est prévenu aussi
    expect(emitToUsers).toHaveBeenCalledWith([2, 3, 4], 'group:updated', { group_id: 7 });
  });

  test('le créateur retire un membre', async () => {
    base();
    expect((await retirer(2, 4)).status).toBe(200);
  });

  test('403 : un membre ne retire pas quelqu\'un d\'autre', async () => {
    base();
    const res = await retirer(MOI, 4);

    expect(res.status).toBe(403);
    expect(requetes('DELETE FROM message_group_member')).toHaveLength(0);
  });

  test('le créateur qui quitte passe la main au membre le plus ancien', async () => {
    base();
    const res = await retirer(2, 2);

    expect(res.status).toBe(200);
    expect(res.body.created_by).toBe(4);
  });

  test('404 si l\'agent visé n\'est pas membre', async () => {
    base();
    expect((await retirer(2, 9)).status).toBe(404);
  });
});
