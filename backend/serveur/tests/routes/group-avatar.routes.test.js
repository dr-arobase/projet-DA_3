/**
 * Photo d'un groupe de discussion : seul le créateur la change ou la retire.
 * Refus : non-membre (403), membre qui n'est pas le créateur (403), fichier qui n'est pas une image (415).
 * La base de données est simulée : aucun PostgreSQL requis.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import { existsSync, unlinkSync } from 'node:fs';

process.env.JWT_SECRET = 'test-secret';

const query = jest.fn();
jest.unstable_mockModule('../../src/config/db.js', () => ({
  pool: { query },
  initializeDatabase: jest.fn(),
  closeDatabase: jest.fn(),
  withTransaction: jest.fn(async (fn) => fn({ query })),
}));

const emitToUsers = jest.fn();
jest.unstable_mockModule('../../src/sockets/index.js', () => ({
  default: jest.fn(),
  emitEvent: jest.fn(),
  emitToUsers,
  disconnectUser: jest.fn(),
}));

jest.unstable_mockModule('../../src/utils/account-status.js', () => ({
  isAccountActive: jest.fn(async () => true),
  getAccountAuthInfo: jest.fn(async (id) => ({
    id, badge_number: `PL-${String(id).padStart(3, '0')}`, role: 'policier',
    grade: 'sergent_autres_fonctions', is_active: true,
  })),
  publishAccountDeactivated: jest.fn(),
  listenForAccountDeactivations: jest.fn(),
}));

const { default: app } = await import('../../src/app.js');
const { AVATARS_DIR } = await import('../../src/middleware/upload.middleware.js');

const session = (id) => `Bearer ${jwt.sign({ id, role: 'policier' }, 'test-secret')}`;
const CREATEUR = 2;
const MEMBRE = 3;
const ETRANGER = 9;

const membre = (id) => ({ id, first_name: `Prénom${id}`, last_name: `Nom${id}`, badge_number: `PL-00${id}` });
const groupe = (extra = {}) => ({
  id: 7, name: 'Patrouille nord', created_by: CREATEUR, created_at: '2026-10-15T10:00:00Z',
  avatar_url: null, members: [membre(2), membre(3), membre(4)], ...extra,
});

// Les 8 octets de signature d'un PNG, suivis de données quelconques
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

let enregistree = null;
beforeEach(() => {
  query.mockReset();
  emitToUsers.mockReset();
  enregistree = null;
  query.mockImplementation(async (sql, params) => {
    if (sql.includes('UPDATE message_group SET avatar_url')) {
      enregistree = params[0];
      return { rows: [{ id: 7 }] };
    }
    if (sql.includes('FROM message_group g WHERE g.id')) return { rows: [groupe({ avatar_url: enregistree })] };
    throw new Error(`Requête inattendue : ${sql}`);
  });
});

const envoyer = (id, corps, type = 'image/png') => request(app)
  .put('/api/messages/groups/7/avatar')
  .set('Authorization', session(id))
  .set('Content-Type', type)
  .send(corps);

describe('PUT /api/messages/groups/:groupId/avatar', () => {
  test('le créateur change la photo : fichier enregistré, membres prévenus en direct', async () => {
    const res = await envoyer(CREATEUR, PNG);
    expect(res.status).toBe(200);
    expect(res.body.avatar_url).toMatch(/^\/api\/uploads\/avatars\/groupe-7-\d+\.png$/);
    expect(emitToUsers).toHaveBeenCalledWith([2, 3, 4], 'group:updated', { group_id: 7 });

    const fichier = path.join(AVATARS_DIR, path.basename(res.body.avatar_url));
    expect(existsSync(fichier)).toBe(true);
    unlinkSync(fichier);
  });

  test('un membre qui n\'est pas le créateur est refusé (403), rien n\'est enregistré', async () => {
    const res = await envoyer(MEMBRE, PNG);
    expect(res.status).toBe(403);
    expect(enregistree).toBeNull();
  });

  test('un agent hors du groupe est refusé (403)', async () => {
    const res = await envoyer(ETRANGER, PNG);
    expect(res.status).toBe(403);
    expect(enregistree).toBeNull();
  });

  test('un fichier qui n\'est pas une image est refusé (415), même avec un type image', async () => {
    const res = await envoyer(CREATEUR, Buffer.from('<svg onload="alert(1)"></svg>'.padEnd(40)));
    expect(res.status).toBe(415);
    expect(enregistree).toBeNull();
  });

  test('sans session : 401', async () => {
    const res = await request(app).put('/api/messages/groups/7/avatar').set('Content-Type', 'image/png').send(PNG);
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/messages/groups/:groupId/avatar', () => {
  test('le créateur retire la photo : retour à l\'icône', async () => {
    const res = await request(app).delete('/api/messages/groups/7/avatar').set('Authorization', session(CREATEUR));
    expect(res.status).toBe(200);
    expect(res.body.avatar_url).toBeNull();
  });

  test('un membre qui n\'est pas le créateur est refusé (403)', async () => {
    const res = await request(app).delete('/api/messages/groups/7/avatar').set('Authorization', session(MEMBRE));
    expect(res.status).toBe(403);
  });
});
