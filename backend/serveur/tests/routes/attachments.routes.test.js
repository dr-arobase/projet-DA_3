/**
 * Tests des pièces jointes de la messagerie (#57) et des messages vocaux (#59) avec Supertest.
 * La base est simulée ; l'écriture sur le disque aussi, sauf pour le test de lecture d'un fichier.
 */
import { jest, describe, test, expect, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

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
  disconnectUser: jest.fn(),
}));

// Le middleware d'authentification relit le compte de l'agent connecté : il est toujours actif ici.
// (Le destinataire, lui, est lu via pool.query et peut être désactivé dans le test.)
jest.unstable_mockModule('../../src/utils/account-status.js', () => ({
  isAccountActive: jest.fn(async () => true),
  getAccountAuthInfo: jest.fn(async (id) => ({
    id, badge_number: `PL-00${id}`, role: 'policier', grade: 'sergent_autres_fonctions', is_active: true,
  })),
  publishAccountDeactivated: jest.fn(),
  listenForAccountDeactivations: jest.fn(),
}));

// Le disque : on note ce qui serait écrit ou effacé, sans rien écrire
const writeFile = jest.fn(async () => {});
const unlink = jest.fn(async () => {});
const mkdir = jest.fn(async () => {});
jest.unstable_mockModule('node:fs/promises', () => ({
  writeFile, unlink, mkdir, readFile: jest.fn(), rename: jest.fn(), default: {},
}));

const { default: app } = await import('../../src/app.js');
const { ATTACHMENTS_DIR } = await import('../../src/middleware/attachment.middleware.js');

const session = (id) => `Bearer ${jwt.sign({ id, badge_number: `PL-00${id}`, role: 'policier', grade: 'sergent_autres_fonctions' }, 'test-secret')}`;
const MOI = 3;

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);
const GIF = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(40)]);
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(40)]);
const HTML = Buffer.from('<html><script>alert(1)</script></html>');

// Réponses de la base selon la requête
function base({ destinataireActif = true, membres = [MOI, 2], message = null } = {}) {
  query.mockImplementation(async (sql, params = []) => {
    if (sql.includes('FROM app_user WHERE id')) {
      return { rows: [{ id: params[0], is_active: destinataireActif }] };
    }
    if (sql.includes('FROM message_group g WHERE g.id')) {
      return { rows: [{ id: params[0], name: 'Patrouille', created_by: MOI, members: membres.map((id) => ({ id })) }] };
    }
    if (sql.includes('INSERT INTO message')) {
      return { rows: [{ id: 50, sender_id: params[0], body: params[2], attachment_name: params[4], attachment_kind: params[7] }] };
    }
    if (sql.includes('FROM message WHERE id')) return { rows: message ? [message] : [] };
    if (sql.includes('FROM message_group_member WHERE group_id')) {
      return { rows: membres.includes(params[1]) ? [{ '?column?': 1 }] : [] };
    }
    return { rows: [] };
  });
}

const envoyer = (contenu, type, params, qui = MOI) =>
  request(app).post(`/api/messages/attachments?${new URLSearchParams(params)}`)
    .set('Authorization', session(qui)).set('Content-Type', type).send(contenu);

beforeEach(() => {
  query.mockReset();
  emitToUsers.mockReset();
  writeFile.mockClear();
  unlink.mockClear();
});

describe('POST /api/messages/attachments', () => {
  test('401 sans session', async () => {
    const res = await request(app).post('/api/messages/attachments?recipient_id=2').set('Content-Type', 'image/png').send(PNG);
    expect(res.status).toBe(401);
  });

  test('201 : une image envoyée à un agent est enregistrée et poussée aux deux agents', async () => {
    base();
    const res = await envoyer(PNG, 'image/png', { recipient_id: 2, name: 'C:\\photos\\suspect.png' });

    expect(res.status).toBe(201);
    expect(writeFile).toHaveBeenCalledTimes(1);
    const [chemin, donnees] = writeFile.mock.calls[0];
    expect(path.dirname(chemin)).toBe(ATTACHMENTS_DIR);
    expect(path.basename(chemin)).toMatch(/^[0-9a-f]{32}\.png$/); // nom choisi par le serveur
    expect(donnees.equals(PNG)).toBe(true);

    const insert = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO message'))[1];
    expect(insert.slice(0, 3)).toEqual([MOI, 2, '']);
    expect(insert.slice(4)).toEqual(['suspect.png', 'image/png', PNG.length, 'image']); // sans le chemin
    expect(emitToUsers).toHaveBeenCalledWith([2, MOI], 'message:new', expect.objectContaining({ id: 50 }));
  });

  test('201 : un GIF animé est accepté comme image', async () => {
    base();
    const res = await envoyer(GIF, 'image/gif', { recipient_id: 2, name: 'bravo.gif' });
    expect(res.status).toBe(201);
    expect(res.body.data.attachment_kind).toBe('image');
  });

  test('201 : un message vocal (audio/webm;codecs=opus) dans un groupe est poussé à tous les membres', async () => {
    base({ membres: [MOI, 2, 5] });
    const res = await envoyer(WEBM, 'audio/webm;codecs=opus', { group_id: 7, name: 'message-vocal.webm' });

    expect(res.status).toBe(201);
    expect(res.body.data.attachment_kind).toBe('audio');
    expect(emitToUsers).toHaveBeenCalledWith([MOI, 2, 5], 'group:message', expect.objectContaining({ id: 50 }));
  });

  test('415 : une page HTML déguisée en PNG est refusée (le type est vérifié sur les octets)', async () => {
    base();
    const res = await envoyer(HTML, 'image/png', { recipient_id: 2 });
    expect(res.status).toBe(415);
    expect(writeFile).not.toHaveBeenCalled();
  });

  test('415 : HTML, SVG et exécutables sont refusés', async () => {
    base();
    for (const type of ['text/html', 'image/svg+xml', 'application/x-msdownload']) {
      const res = await envoyer(HTML, type, { recipient_id: 2 });
      expect(res.status).toBe(415);
    }
    expect(writeFile).not.toHaveBeenCalled();
  });

  test('400 sans destinataire ni groupe, ou avec les deux', async () => {
    base();
    expect((await envoyer(PNG, 'image/png', {})).status).toBe(400);
    expect((await envoyer(PNG, 'image/png', { recipient_id: 2, group_id: 7 })).status).toBe(400);
    expect(writeFile).not.toHaveBeenCalled();
  });

  test('403 dans un groupe dont on n\'est pas membre, même en appelant l\'API à la main', async () => {
    base({ membres: [2, 5] });
    const res = await envoyer(PNG, 'image/png', { group_id: 7 });
    expect(res.status).toBe(403);
    expect(writeFile).not.toHaveBeenCalled();
  });

  test('404 si le destinataire est désactivé', async () => {
    base({ destinataireActif: false });
    const res = await envoyer(PNG, 'image/png', { recipient_id: 2 });
    expect(res.status).toBe(404);
    expect(writeFile).not.toHaveBeenCalled();
  });

  test('413 au-delà de 10 Mo, avec un message en français', async () => {
    base();
    const gros = Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024)]);
    const res = await envoyer(gros, 'image/png', { recipient_id: 2 });
    expect(res.status).toBe(413);
    expect(res.body.message).toBe('Le fichier dépasse 10 Mo');
  });
});

describe('GET /api/messages/:messageId/attachment', () => {
  const FICHIER = 'test-lecture.png';
  const prive = {
    id: 50, sender_id: 2, recipient_id: MOI, group_id: null, deleted_at: null,
    attachment_path: FICHIER, attachment_name: 'suspect.png', attachment_type: 'image/png', attachment_kind: 'image',
  };

  afterAll(() => rmSync(path.join(ATTACHMENTS_DIR, FICHIER), { force: true }));

  test('200 pour un participant, avec le bon type et nosniff', async () => {
    mkdirSync(ATTACHMENTS_DIR, { recursive: true });
    writeFileSync(path.join(ATTACHMENTS_DIR, FICHIER), PNG);
    base({ message: prive });

    const res = await request(app).get('/api/messages/50/attachment').set('Authorization', session(MOI));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-disposition']).toMatch(/^inline;/);
  });

  test('403 pour un agent qui n\'est pas dans la conversation, même avec l\'adresse', async () => {
    base({ message: prive });
    const res = await request(app).get('/api/messages/50/attachment').set('Authorization', session(9));
    expect(res.status).toBe(403);
  });

  test('403 pour un non-membre du groupe', async () => {
    base({ message: { ...prive, recipient_id: null, group_id: 7 }, membres: [2, 5] });
    const res = await request(app).get('/api/messages/50/attachment').set('Authorization', session(MOI));
    expect(res.status).toBe(403);
  });

  test('404 si le message est supprimé', async () => {
    base({ message: { ...prive, deleted_at: new Date().toISOString(), attachment_path: null } });
    const res = await request(app).get('/api/messages/50/attachment').set('Authorization', session(MOI));
    expect(res.status).toBe(404);
  });

  test('les pièces jointes ne sont pas servies par /api/uploads', async () => {
    const res = await request(app).get(`/api/uploads/messages/${FICHIER}`).set('Authorization', session(MOI));
    expect(res.status).toBe(404);
  });
});
