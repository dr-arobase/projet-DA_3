/**
 * Tests des routes /api/auth (login / logout) avec Supertest.
 * La base de données est simulée : aucun PostgreSQL requis.
 */
import { jest, describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret';

const query = jest.fn();
jest.unstable_mockModule('../../src/config/db.js', () => ({
  pool: { query },
  initializeDatabase: jest.fn(),
  closeDatabase: jest.fn(),
  withTransaction: jest.fn(),
}));

const { default: app } = await import('../../src/app.js');

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
