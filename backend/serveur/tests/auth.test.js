// Récit #1 — S'authentifier avec badge et mot de passe (ticket #3)
import request from 'supertest';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { loginAs, PASSWORD, resetDatabase } from './helpers.js';

beforeAll(resetDatabase);
afterAll(() => pool.end());

describe('POST /auth/login', () => {
  test('bon matricule et bon mot de passe : 200, profil et cookie de session HTTP-only', async () => {
    const res = await request(app).post('/auth/login').send({ badge_number: 'PL-003', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ badge_number: 'PL-003', role: 'policier' });
    expect(res.body.user).not.toHaveProperty('password_hash');
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/^session=/);
    expect(cookie).toMatch(/HttpOnly/);
  });

  test('mauvais mot de passe et matricule inconnu : même 401, sans dire lequel est faux', async () => {
    const wrongPassword = await request(app).post('/auth/login').send({ badge_number: 'PL-003', password: 'mauvais' });
    const unknownBadge = await request(app).post('/auth/login').send({ badge_number: 'XX-999', password: PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownBadge.status).toBe(401);
    expect(wrongPassword.body.message).toBe(unknownBadge.body.message);
    expect(wrongPassword.headers['set-cookie']).toBeUndefined();
  });

  test('compte désactivé : 403 avec un message clair', async () => {
    const res = await request(app).post('/auth/login').send({ badge_number: 'PL-005', password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/désactivé/);
  });

  test('champs vides : 400 avec une erreur par champ', async () => {
    const res = await request(app).post('/auth/login').send({ badge_number: '', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty('badge_number');
    expect(res.body.errors).toHaveProperty('password');
  });

  test('JSON illisible : 400', async () => {
    const res = await request(app).post('/auth/login').set('Content-Type', 'application/json').send('{"badge');
    expect(res.status).toBe(400);
  });

  test('les mots de passe sont hachés en base (bcrypt)', async () => {
    const { rows } = await pool.query('SELECT password_hash FROM app_user');
    for (const { password_hash } of rows) {
      expect(password_hash).toMatch(/^\$2[aby]\$10\$/);
      expect(password_hash).not.toContain(PASSWORD);
    }
  });
});

describe('session', () => {
  test('la session persiste : /auth/me répond avec le compte connecté', async () => {
    const agent = await loginAs('SM-002');
    const res = await agent.get('/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ badge_number: 'SM-002', role: 'superviseur' });
  });

  test('sans cookie : 401', async () => {
    expect((await request(app).get('/auth/me')).status).toBe(401);
  });

  test('cookie falsifié : 401', async () => {
    const res = await request(app).get('/auth/me').set('Cookie', 'session=eyJhbGciOiJIUzI1NiJ9.faux.faux');
    expect(res.status).toBe(401);
  });

  test('la déconnexion efface le cookie : la requête suivante est refusée', async () => {
    const agent = await loginAs('PL-004');
    const logout = await agent.post('/auth/logout');
    expect(logout.status).toBe(204);
    expect(logout.headers['set-cookie'][0]).toMatch(/session=;/);
    expect((await agent.get('/auth/me')).status).toBe(401);
  });

  test('un compte désactivé après la connexion perd l\'accès immédiatement', async () => {
    const agent = await loginAs('PL-004');
    await pool.query("UPDATE app_user SET is_active = FALSE WHERE badge_number = 'PL-004'");
    try {
      expect((await agent.get('/api/criminals')).status).toBe(401);
    } finally {
      await pool.query("UPDATE app_user SET is_active = TRUE WHERE badge_number = 'PL-004'");
    }
  });
});
