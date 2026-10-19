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
    expect(query.mock.calls[1][1]).toEqual([3, 2, 'Bien reçu']); // expéditeur tiré de la session, texte nettoyé
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
