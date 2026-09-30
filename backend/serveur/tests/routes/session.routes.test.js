/**
 * Tests de la session par cookie httpOnly (utilisée par le frontend) :
 * login -> cookie, routes protégées avec le cookie, /api/auth/me, logout -> cookie effacé.
 * La base de données est simulée : aucun PostgreSQL requis.
 */
import { jest, describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
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
const { readCookie, tokenFrom, COOKIE_NAME } = await import('../../src/utils/session.js');

let passwordHash;
beforeAll(async () => {
  passwordHash = await bcrypt.hash('secret123', 4);
});

beforeEach(() => {
  query.mockReset();
});

const agent = (extra = {}) => ({
  id: 3, first_name: 'Chrysler', last_name: 'Jean', badge_number: 'PL-003',
  password_hash: passwordHash, role: 'policier', grade: 'sergent_autres_fonctions', is_active: true, ...extra,
});

const cookieDe = (res) => (res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${COOKIE_NAME}=`));

async function seConnecter(body = {}) {
  query.mockResolvedValueOnce({ rows: [agent()] });
  return request(app).post('/api/auth/login').send({ badge_number: 'PL-003', password: 'secret123', ...body });
}

describe('utils/session', () => {
  test('readCookie retrouve la valeur parmi plusieurs cookies', () => {
    expect(readCookie(`a=1; ${COOKIE_NAME}=abc.def; b=2`)).toBe('abc.def');
    expect(readCookie('a=1')).toBeNull();
    expect(readCookie(undefined)).toBeNull();
  });

  test('tokenFrom privilégie l\'en-tête Bearer, sinon le cookie', () => {
    expect(tokenFrom({ authorization: 'Bearer entete', cookie: `${COOKIE_NAME}=cookie` })).toBe('entete');
    expect(tokenFrom({ cookie: `${COOKIE_NAME}=cookie` })).toBe('cookie');
    expect(tokenFrom({})).toBeNull();
  });
});

describe('POST /api/auth/login', () => {
  test('pose un cookie httpOnly SameSite=Lax contenant le jeton', async () => {
    const res = await seConnecter();

    expect(res.status).toBe(200);
    const cookie = cookieDe(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toContain(`${COOKIE_NAME}=${res.body.token}`);
  });

  test('sans « se souvenir de moi » : cookie de session (pas de date d\'expiration)', async () => {
    const cookie = cookieDe(await seConnecter());

    expect(cookie).not.toMatch(/Max-Age|Expires/i);
  });

  test('avec « se souvenir de moi » : cookie persistant de 8 h', async () => {
    const cookie = cookieDe(await seConnecter({ se_souvenir: true }));

    expect(cookie).toMatch(/Max-Age=28800/);
  });

  test('aucun cookie si les identifiants sont faux', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/api/auth/login').send({ badge_number: 'X', password: 'y' });

    expect(res.status).toBe(401);
    expect(cookieDe(res)).toBeUndefined();
  });
});

describe('routes protégées avec le cookie seul', () => {
  test('GET /api/auth/me renvoie le profil sans le mot de passe', async () => {
    const cookie = cookieDe(await seConnecter()).split(';')[0];
    query.mockResolvedValueOnce({ rows: [agent()] });

    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: 3, first_name: 'Chrysler', last_name: 'Jean', badge_number: 'PL-003',
      role: 'policier', grade: 'sergent_autres_fonctions',
    });
  });

  test('GET /api/auth/me : 401 si le compte a été désactivé depuis la connexion', async () => {
    const token = jwt.sign({ id: 3, role: 'policier' }, 'test-secret');
    query.mockResolvedValueOnce({ rows: [agent({ is_active: false })] });

    const res = await request(app).get('/api/auth/me').set('Cookie', `${COOKIE_NAME}=${token}`);

    expect(res.status).toBe(401);
  });

  test('GET /api/auth/me : 401 sans cookie ni jeton', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
  });

  test('GET /api/criminals fonctionne avec le cookie', async () => {
    const token = jwt.sign({ id: 3, role: 'policier' }, 'test-secret');
    query.mockImplementation(async (sql) =>
      sql.includes('COUNT(*)') ? { rows: [{ count: '0' }] } : { rows: [] });

    const res = await request(app).get('/api/criminals').set('Cookie', `${COOKIE_NAME}=${token}`);

    expect(res.status).toBe(200);
  });

  test('un cookie falsifié est refusé (403)', async () => {
    const forged = jwt.sign({ id: 1, role: 'direction' }, 'autre-cle');

    const res = await request(app).get('/api/audit-logs').set('Cookie', `${COOKIE_NAME}=${forged}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/auth/logout', () => {
  test('efface le cookie de session', async () => {
    const token = jwt.sign({ id: 3, role: 'policier' }, 'test-secret');

    const res = await request(app).post('/api/auth/logout').set('Cookie', `${COOKIE_NAME}=${token}`);

    expect(res.status).toBe(200);
    expect(cookieDe(res)).toMatch(new RegExp(`^${COOKIE_NAME}=;`));
    expect(cookieDe(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});
