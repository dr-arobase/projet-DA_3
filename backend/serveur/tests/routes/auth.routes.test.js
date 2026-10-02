/**
 * Tests des routes /api/auth (login / logout) avec Supertest.
 * La base de données est simulée : aucun PostgreSQL requis.
 */
import { jest, describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';

process.env.JWT_SECRET = 'test-secret';

const query = jest.fn();
jest.unstable_mockModule('../../src/config/db.js', () => ({
  pool: { query },
  initializeDatabase: jest.fn(),
  closeDatabase: jest.fn(),
  withTransaction: jest.fn(),
}));

const { default: app } = await import('../../src/app.js');
const { AVATARS_DIR } = await import('../../src/middleware/upload.middleware.js');

let passwordHash;
let consoleSpy;

beforeAll(async () => {
  passwordHash = await bcrypt.hash('secret123', 4);
});

beforeEach(() => {
  query.mockReset();
  consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
});

const agent = () => ({
  id: 3,
  first_name: 'Chrysler',
  last_name: 'Jean',
  badge_number: 'PL-003',
  password_hash: passwordHash,
  role: 'policier',
  grade: 'sergent_autres_fonctions',
});

describe('POST /api/auth/login', () => {
  test.each([
    [{}],
    [{ badge_number: 'PL-003' }],
    [{ password: 'secret123' }],
    [{ badge_number: '', password: '' }],
  ])('400 si des champs manquent : %j', async (body) => {
    const res = await request(app).post('/api/auth/login').send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/requis/);
    expect(query).not.toHaveBeenCalled();
  });

  test('401 si le matricule est inconnu ou le compte inactif', async () => {
    query.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ badge_number: 'XX-000', password: 'secret123' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Identifiants invalides/);
  });

  test('401 si le mot de passe est incorrect', async () => {
    query.mockResolvedValue({ rows: [agent()] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ badge_number: 'PL-003', password: 'mauvais' });

    expect(res.status).toBe(401);
  });

  test('200 avec un jeton et l\'agent si les identifiants sont bons', async () => {
    query.mockResolvedValue({ rows: [agent()] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ badge_number: 'PL-003', password: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ id: 3, badge_number: 'PL-003', role: 'policier' });
    expect(res.body.user).not.toHaveProperty('password_hash');
    expect(jwt.verify(res.body.token, 'test-secret').id).toBe(3);
  });

  test('accepte aussi un formulaire urlencoded', async () => {
    query.mockResolvedValue({ rows: [agent()] });

    const res = await request(app)
      .post('/api/auth/login')
      .type('form')
      .send({ badge_number: 'PL-003', password: 'secret123' });

    expect(res.status).toBe(200);
  });

  test('500 si la base de données plante', async () => {
    query.mockRejectedValue(new Error('DB down'));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ badge_number: 'PL-003', password: 'secret123' });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Erreur serveur');
  });
});

describe('POST /api/auth/logout', () => {
  test('401 sans jeton', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(401);
  });

  test('403 avec un jeton invalide', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', 'Bearer faux.jeton.jwt');

    expect(res.status).toBe(403);
  });

  test('200 avec un jeton valide', async () => {
    const token = jwt.sign({ id: 3, role: 'policier' }, 'test-secret');

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Déconnexion réussie/);
  });

  test('GET /api/auth/logout n\'existe pas (404)', async () => {
    const res = await request(app).get('/api/auth/logout');

    expect(res.status).toBe(404);
  });
});

describe('POST /api/auth/change-password', () => {
  const token = () => jwt.sign({ id: 3, role: 'policier' }, 'test-secret');
  const changer = (body) => request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${token()}`)
    .send(body);

  test('401 sans jeton', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ old_password: 'secret123', new_password: 'nouveau123' });

    expect(res.status).toBe(401);
  });

  test.each([
    [{}],
    [{ old_password: 'secret123' }],
    [{ new_password: 'nouveau123' }],
  ])('400 si des champs manquent : %j', async (body) => {
    const res = await changer(body);

    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  test('400 si le nouveau mot de passe est trop court', async () => {
    const res = await changer({ old_password: 'secret123', new_password: 'court' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/au moins 8/);
  });

  test('400 si le nouveau mot de passe est identique à l\'ancien', async () => {
    const res = await changer({ old_password: 'secret123', new_password: 'secret123' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/différent/);
  });

  test('400 si le mot de passe actuel est incorrect, sans rien modifier', async () => {
    query.mockResolvedValueOnce({ rows: [{ password_hash: passwordHash }] });

    const res = await changer({ old_password: 'mauvais1', new_password: 'nouveau123' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/actuel incorrect/);
    expect(query).toHaveBeenCalledTimes(1);
  });

  test('401 si le compte a été désactivé', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const res = await changer({ old_password: 'secret123', new_password: 'nouveau123' });

    expect(res.status).toBe(401);
  });

  test('200 : enregistre un nouveau hash bcrypt pour l\'agent connecté', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ password_hash: passwordHash }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await changer({ old_password: 'secret123', new_password: 'nouveau123' });

    expect(res.status).toBe(200);
    const [sql, [hash, id]] = query.mock.calls[1];
    expect(sql).toMatch(/UPDATE app_user SET password_hash/);
    expect(id).toBe(3);
    expect(await bcrypt.compare('nouveau123', hash)).toBe(true);
  });
});

describe('PUT /api/auth/avatar', () => {
  const token = () => jwt.sign({ id: 3, role: 'policier' }, 'test-secret');
  // Les 8 octets de signature d'un PNG, suivis de données quelconques
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
  const envoyer = (type, data) => request(app)
    .put('/api/auth/avatar')
    .set('Authorization', `Bearer ${token()}`)
    .set('Content-Type', type)
    .send(data);

  test('401 sans jeton', async () => {
    const res = await request(app).put('/api/auth/avatar').set('Content-Type', 'image/png').send(png);

    expect(res.status).toBe(401);
  });

  test('415 si ce n\'est pas une image acceptée', async () => {
    const res = await envoyer('text/plain', 'bonjour');

    expect(res.status).toBe(415);
    expect(query).not.toHaveBeenCalled();
  });

  test('415 si le contenu ne correspond pas au type annoncé', async () => {
    const res = await envoyer('image/png', Buffer.from('<script>alert(1)</script>'));

    expect(res.status).toBe(415);
    expect(query).not.toHaveBeenCalled();
  });

  test('413 au-delà de 2 Mo', async () => {
    const res = await envoyer('image/png', Buffer.concat([png, Buffer.alloc(2 * 1024 * 1024)]));

    expect(res.status).toBe(413);
  });

  test('200 : enregistre le fichier et renvoie le profil avec avatar_url', async () => {
    let avatarUrl;
    query.mockImplementation(async (sql, params) => {
      if (sql.startsWith('UPDATE')) {
        avatarUrl = params[0];
        return { rows: [{ ...agent(), email: 'cj@crimetracker.local', avatar_url: avatarUrl }] };
      }
      return { rows: [{ ...agent(), is_active: true, avatar_url: null }] };
    });

    const res = await envoyer('image/png', png);

    expect(res.status).toBe(200);
    expect(avatarUrl).toMatch(/^\/api\/uploads\/avatars\/3-\d+\.png$/);
    expect(res.body.user.avatar_url).toBe(avatarUrl);
    expect(res.body.user).not.toHaveProperty('password_hash');

    const fichier = path.join(AVATARS_DIR, path.basename(avatarUrl));
    expect(existsSync(fichier)).toBe(true);
    unlinkSync(fichier);
  });
});

describe('DELETE /api/auth/avatar', () => {
  test('200 : remet avatar_url à null', async () => {
    query.mockImplementation(async (sql) => (sql.startsWith('UPDATE')
      ? { rows: [{ ...agent(), avatar_url: null }] }
      : { rows: [{ ...agent(), is_active: true, avatar_url: '/api/uploads/avatars/3-1.png' }] }));

    const res = await request(app)
      .delete('/api/auth/avatar')
      .set('Authorization', `Bearer ${jwt.sign({ id: 3, role: 'policier' }, 'test-secret')}`);

    expect(res.status).toBe(200);
    expect(res.body.user.avatar_url).toBeNull();
  });
});

describe('GET /api/uploads', () => {
  test('401 : les photos ne sont pas accessibles sans être connecté', async () => {
    const res = await request(app).get('/api/uploads/avatars/3-1.png');

    expect(res.status).toBe(401);
  });
});
