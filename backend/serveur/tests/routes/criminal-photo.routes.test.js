/**
 * Photo du dossier d'une personne recherchée : tout agent l'ajoute ou la change, un superviseur la retire.
 * Refus : fichier qui n'est pas une image (415), policier qui retire (403), dossier inconnu (404).
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
  withTransaction: jest.fn(),
}));

const emitEvent = jest.fn();
jest.unstable_mockModule('../../src/sockets/index.js', () => ({
  default: jest.fn(),
  emitEvent,
  emitToUsers: jest.fn(),
  disconnectUser: jest.fn(),
}));

let role = 'policier';
jest.unstable_mockModule('../../src/utils/account-status.js', () => ({
  isAccountActive: jest.fn(async () => true),
  getAccountAuthInfo: jest.fn(async (id) => ({
    id, badge_number: 'PL-007', role, grade: 'sergent_autres_fonctions', is_active: true,
  })),
  publishAccountDeactivated: jest.fn(),
  listenForAccountDeactivations: jest.fn(),
}));

const { default: app } = await import('../../src/app.js');
const { PHOTOS_DIR } = await import('../../src/middleware/upload.middleware.js');

const session = (r = 'policier') => {
  role = r;
  return `Bearer ${jwt.sign({ id: 7, role: r }, 'test-secret')}`;
};

// Les 8 octets de signature d'un PNG, suivis de données quelconques
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

let photo = null;
let audit = [];
beforeEach(() => {
  query.mockReset();
  emitEvent.mockReset();
  photo = null;
  audit = [];
  query.mockImplementation(async (sql, params) => {
    if (sql.includes('UPDATE criminal SET photo_url')) {
      photo = params[0];
      return { rows: [{ id: params[2] }] };
    }
    if (sql.includes('INSERT INTO audit_log')) {
      audit.push(params[1]);
      return { rows: [{ id: 1 }] };
    }
    if (sql.includes('FROM criminal c') && sql.includes('WHERE c.id = $1')) {
      return { rows: params[0] === '1' || params[0] === 1 ? [{ id: 1, first_name: 'Jean', last_name: 'Dupont', status: 'recherche', version: 2, photo_url: photo }] : [] };
    }
    throw new Error(`Requête inattendue : ${sql}`);
  });
});

const envoyer = (id, corps, r = 'policier', type = 'image/png') => request(app)
  .put(`/api/criminals/${id}/photo`)
  .set('Authorization', session(r))
  .set('Content-Type', type)
  .send(corps);

describe('PUT /api/criminals/:id/photo', () => {
  test('un policier ajoute la photo : fichier enregistré, audit, diffusion en direct', async () => {
    const res = await envoyer(1, PNG);
    expect(res.status).toBe(200);
    expect(res.body.criminal.photo_url).toMatch(/^\/api\/uploads\/photos\/dossier-1-\d+\.png$/);
    expect(audit).toContain('CRIMINAL_PHOTO_CHANGED');
    expect(emitEvent).toHaveBeenCalledWith('criminal:updated', expect.objectContaining({ id: 1 }));

    const fichier = path.join(PHOTOS_DIR, path.basename(res.body.criminal.photo_url));
    expect(existsSync(fichier)).toBe(true);
    unlinkSync(fichier);
  });

  test('un fichier qui n\'est pas une image est refusé (415), même avec un type image', async () => {
    const res = await envoyer(1, Buffer.from('<svg onload="alert(1)"></svg>'.padEnd(40)));
    expect(res.status).toBe(415);
    expect(photo).toBeNull();
  });

  test('un autre type de fichier (PDF) est refusé (415)', async () => {
    const res = await envoyer(1, Buffer.from('%PDF-1.4 fichier'), 'policier', 'application/pdf');
    expect(res.status).toBe(415);
  });

  test('dossier inconnu : 404', async () => {
    const res = await envoyer(999, PNG);
    expect(res.status).toBe(404);
  });

  test('sans session : 401', async () => {
    const res = await request(app).put('/api/criminals/1/photo').set('Content-Type', 'image/png').send(PNG);
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/criminals/:id/photo', () => {
  test('un policier ne peut pas retirer la photo (403)', async () => {
    const res = await request(app).delete('/api/criminals/1/photo').set('Authorization', session('policier'));
    expect(res.status).toBe(403);
    expect(audit).toHaveLength(0);
  });

  test('un superviseur la retire : retour aux initiales, inscrit au journal', async () => {
    const res = await request(app).delete('/api/criminals/1/photo').set('Authorization', session('superviseur'));
    expect(res.status).toBe(200);
    expect(res.body.criminal.photo_url).toBeNull();
    expect(audit).toContain('CRIMINAL_PHOTO_REMOVED');
  });
});
