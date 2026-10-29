/**
 * Tests des routes /api/messages (messagerie privée) avec Supertest.
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

const emitToUsers = jest.fn();
jest.unstable_mockModule('../../src/sockets/index.js', () => ({
  default: jest.fn(),
  emitEvent: jest.fn(),
  emitToUsers,
}));

const { default: app } = await import('../../src/app.js');

// L'agent connecté a l'id 3
const bearer = `Bearer ${jwt.sign({ id: 3, badge_number: 'PL-003', role: 'policier', grade: 'sergent_autres_fonctions' }, 'test-secret')}`;

beforeEach(() => {
  query.mockReset();
  emitToUsers.mockReset();
});

describe('accès', () => {
  test('401 sans session', async () => {
    const res = await request(app).get('/api/messages/contacts');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/messages/contacts', () => {
  test('liste les agents actifs sauf soi, avec les non-lus', async () => {
    const contacts = [{ id: 2, first_name: 'Eric', last_name: 'Tremblay', unread: 2 }];
    query.mockResolvedValueOnce({ rows: contacts });

    const res = await request(app).get('/api/messages/contacts').set('Authorization', bearer);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(contacts);
    expect(query.mock.calls[0][1]).toEqual([3]);
    expect(query.mock.calls[0][0]).toMatch(/u\.id <> \$1/);
  });
});

describe('GET /api/messages/unread', () => {
  test('401 sans session', async () => {
    const res = await request(app).get('/api/messages/unread');
    expect(res.status).toBe(401);
  });

  test('renvoie le total des non-lus de l\'agent connecté, privés et de groupe', async () => {
    query.mockResolvedValueOnce({ rows: [{ total: '4' }] }); // COUNT(*) arrive en texte

    const res = await request(app).get('/api/messages/unread').set('Authorization', bearer);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ total: 4 });
    expect(query.mock.calls[0][1]).toEqual([3]); // seulement les messages de l'agent connecté
    expect(query.mock.calls[0][0]).toMatch(/m\.recipient_id = \$1 AND m\.read_at IS NULL/);
    expect(query.mock.calls[0][0]).toMatch(/m\.sender_id <> \$1 AND m\.created_at > gm\.last_read_at/);
  });

  test('« unread » n\'est pas pris pour un identifiant d\'agent', async () => {
    query.mockResolvedValueOnce({ rows: [{ total: 0 }] });

    const res = await request(app).get('/api/messages/unread').set('Authorization', bearer);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ total: 0 });
    expect(query.mock.calls[0][0]).not.toMatch(/UPDATE message SET read_at/);
  });
});

describe('GET /api/messages/:userId', () => {
  test('marque les messages reçus comme lus, renvoie la conversation et prévient l\'expéditeur', async () => {
    const messages = [{ id: 1, sender_id: 2, recipient_id: 3, body: 'Bonjour' }];
    query
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // UPDATE read_at
      .mockResolvedValueOnce({ rows: messages }); // conversation

    const res = await request(app).get('/api/messages/2').set('Authorization', bearer);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(messages);
    expect(query.mock.calls[0][0]).toMatch(/UPDATE message SET read_at/);
    expect(query.mock.calls[0][1]).toEqual([3, 2]); // destinataire = moi, expéditeur = l'autre
    expect(emitToUsers).toHaveBeenCalledWith([2], 'message:read', { by: 3 });
    // La pastille du menu du lecteur baisse dans tous ses onglets
    expect(emitToUsers).toHaveBeenCalledWith([3], 'messages:lus', {});
  });

  test('ne prévient personne s\'il n\'y avait rien à marquer', async () => {
    query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/messages/2').set('Authorization', bearer);

    expect(res.status).toBe(200);
    expect(emitToUsers).not.toHaveBeenCalled();
  });

  test('400 si l\'identifiant n\'est pas un nombre', async () => {
    const res = await request(app).get('/api/messages/abc').set('Authorization', bearer);
    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('POST /api/messages', () => {
  const envoyer = (corps) => request(app).post('/api/messages').set('Authorization', bearer).send(corps);

  test('201 : enregistre le message au nom de l\'agent et le pousse aux deux agents', async () => {
    const cree = { id: 9, sender_id: 3, recipient_id: 2, body: 'Bien reçu' };
    query
      .mockResolvedValueOnce({ rows: [{ id: 2, is_active: true }] }) // destinataire
      .mockResolvedValueOnce({ rows: [cree] }); // INSERT

    const res = await envoyer({ recipient_id: 2, body: '  Bien reçu  ' });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(cree);
    expect(query.mock.calls[1][1]).toEqual([3, 2, 'Bien reçu', null, null, null, null, null]); // expéditeur tiré de la session, texte nettoyé
    expect(emitToUsers).toHaveBeenCalledWith([2, 3], 'message:new', cree);
  });

  test('400 si le message est vide', async () => {
    const res = await envoyer({ recipient_id: 2, body: '   ' });
    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  test('400 si le message est trop long', async () => {
    const res = await envoyer({ recipient_id: 2, body: 'x'.repeat(2001) });
    expect(res.status).toBe(400);
  });

  test('400 si on s\'écrit à soi-même', async () => {
    const res = await envoyer({ recipient_id: 3, body: 'Moi' });
    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  test('404 si le destinataire est désactivé', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 2, is_active: false }] });

    const res = await envoyer({ recipient_id: 2, body: 'Allô' });

    expect(res.status).toBe(404);
    expect(query).toHaveBeenCalledTimes(1); // aucun INSERT
    expect(emitToUsers).not.toHaveBeenCalled();
  });
});

// Un message de l'agent connecté (id 3) à l'agent 2, envoyé il y a `minutes` minutes
const messageDe = (sender_id, minutes, extra = {}) => ({
  id: 9, sender_id, recipient_id: sender_id === 3 ? 2 : 3, group_id: null,
  created_at: new Date(Date.now() - minutes * 60 * 1000).toISOString(), deleted_at: null, ...extra,
});

describe('PATCH /api/messages/:messageId (modifier, #143)', () => {
  const modifier = (corps, id = 9) =>
    request(app).patch(`/api/messages/${id}`).set('Authorization', bearer).send(corps);

  test('200 : l\'expéditeur corrige son message dans les 15 minutes, les deux agents le voient', async () => {
    const modifie = { ...messageDe(3, 5), body: 'Corrigé', edited_at: new Date().toISOString() };
    query
      .mockResolvedValueOnce({ rows: [messageDe(3, 5)] }) // findById
      .mockResolvedValueOnce({ rows: [modifie] }); // UPDATE

    const res = await modifier({ body: '  Corrigé ' });

    expect(res.status).toBe(200);
    expect(res.body.data.body).toBe('Corrigé');
    const [sql, valeurs] = query.mock.calls[1];
    expect(sql).toMatch(/SET body = \$3, edited_at = now\(\)/);
    expect(sql).toMatch(/sender_id = \$2 AND deleted_at IS NULL/);
    expect(sql).toMatch(/created_at > now\(\) - make_interval\(mins => \$4\)/);
    expect(valeurs).toEqual([9, 3, 'Corrigé', 15]);
    expect(emitToUsers).toHaveBeenCalledWith([3, 2], 'message:updated', modifie);
  });

  test('403 après 15 minutes, même en appelant l\'API à la main', async () => {
    query.mockResolvedValueOnce({ rows: [messageDe(3, 16)] });

    const res = await modifier({ body: 'Trop tard' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/15 minutes/);
    expect(query).toHaveBeenCalledTimes(1); // aucun UPDATE
    expect(emitToUsers).not.toHaveBeenCalled();
  });

  test('403 si la base refuse au moment d\'écrire (délai atteint entre-temps)', async () => {
    query
      .mockResolvedValueOnce({ rows: [messageDe(3, 14)] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await modifier({ body: 'Juste à temps ?' });

    expect(res.status).toBe(403);
    expect(emitToUsers).not.toHaveBeenCalled();
  });

  test('403 sur le message d\'un autre agent', async () => {
    query.mockResolvedValueOnce({ rows: [messageDe(2, 1)] });

    const res = await modifier({ body: 'Pas à moi' });

    expect(res.status).toBe(403);
    expect(query).toHaveBeenCalledTimes(1);
  });

  test('400 si le nouveau texte est vide ou trop long', async () => {
    expect((await modifier({ body: '   ' })).status).toBe(400);
    expect((await modifier({ body: 'x'.repeat(2001) })).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  test('404 si le message n\'existe pas ou est supprimé', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect((await modifier({ body: 'Allô' })).status).toBe(404);

    query.mockResolvedValueOnce({ rows: [messageDe(3, 1, { deleted_at: new Date().toISOString() })] });
    expect((await modifier({ body: 'Allô' })).status).toBe(404);
  });

  test('message de groupe : tous les membres reçoivent la modification', async () => {
    const enGroupe = messageDe(3, 2, { recipient_id: null, group_id: 7 });
    query
      .mockResolvedValueOnce({ rows: [enGroupe] })
      .mockResolvedValueOnce({ rows: [{ ...enGroupe, body: 'Corrigé' }] })
      .mockResolvedValueOnce({ rows: [{ id: 7, members: [{ id: 3 }, { id: 2 }, { id: 5 }] }] }); // membres

    const res = await modifier({ body: 'Corrigé' });

    expect(res.status).toBe(200);
    expect(emitToUsers).toHaveBeenCalledWith([3, 2, 5], 'message:updated', expect.objectContaining({ id: 9 }));
  });

  test('400 si l\'identifiant n\'est pas un nombre', async () => {
    const res = await modifier({ body: 'Allô' }, 'abc');
    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/messages/:messageId (supprimer, #144)', () => {
  const supprimer = (id = 9) => request(app).delete(`/api/messages/${id}`).set('Authorization', bearer);

  test('200 : l\'expéditeur supprime son message, le texte est effacé chez les deux agents', async () => {
    const supprime = { ...messageDe(3, 60), body: '', deleted_at: new Date().toISOString() };
    query
      .mockResolvedValueOnce({ rows: [messageDe(3, 60)] }) // pas de délai pour supprimer
      .mockResolvedValueOnce({ rows: [supprime] });

    const res = await supprimer();

    expect(res.status).toBe(200);
    expect(query.mock.calls[1][0]).toMatch(/SET body = '', deleted_at = now\(\)/);
    expect(query.mock.calls[1][1]).toEqual([9, 3]);
    expect(emitToUsers).toHaveBeenCalledWith([3, 2], 'message:deleted', supprime);
  });

  test('403 sur le message d\'un autre agent, même en appelant l\'API à la main', async () => {
    query.mockResolvedValueOnce({ rows: [messageDe(2, 1)] });

    const res = await supprimer();

    expect(res.status).toBe(403);
    expect(query).toHaveBeenCalledTimes(1); // aucun UPDATE
    expect(emitToUsers).not.toHaveBeenCalled();
  });

  test('404 si le message n\'existe pas', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect((await supprimer(42)).status).toBe(404);
  });
});
