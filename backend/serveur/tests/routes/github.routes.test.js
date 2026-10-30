/**
 * Tests de la connexion GitHub (OAuth 2) : départ vers GitHub, vérification du state,
 * création du compte à la première connexion avec le rôle par défaut, compte désactivé.
 * GitHub et la base de données sont simulés : aucun réseau ni PostgreSQL requis.
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

jest.unstable_mockModule('../../src/middleware/login-rate-limit.middleware.js', () => ({
  limitLoginAttempts: (req, res, next) => next(),
}));

const github = {
  isConfigured: jest.fn(),
  authorizationUrl: jest.fn(),
  fetchProfile: jest.fn(),
};
jest.unstable_mockModule('../../src/services/github.service.js', () => github);

jest.unstable_mockModule('../../src/utils/account-status.js', () => ({
  isAccountActive: jest.fn(async () => true),
  getAccountAuthInfo: jest.fn(async (id) => ({
    id, badge_number: 'GH-4242', role: 'policier', grade: 'sergent_autres_fonctions', is_active: true,
  })),
  publishAccountDeactivated: jest.fn(),
  listenForAccountDeactivations: jest.fn(),
}));

const { default: app } = await import('../../src/app.js');
const { COOKIE_NAME, CSRF_COOKIE_NAME } = await import('../../src/utils/session.js');
const { createCsrfToken, verifyCsrfToken } = await import('../../src/utils/csrf.js');

const STATE_COOKIE = 'crimetracker_oauth_state';

beforeEach(() => {
  query.mockReset();
  Object.values(github).forEach((fn) => fn.mockReset());
  github.isConfigured.mockReturnValue(true);
});

const cookieDe = (res, nom) => (res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${nom}=`));

const profilGithub = { id: 4242, login: 'ada', name: 'Ada Lovelace', email: 'ada@example.com' };

const compteGithub = (extra = {}) => ({
  id: 12, first_name: 'Ada', last_name: 'Lovelace', badge_number: 'GH-4242', email: 'ada@example.com',
  role: 'policier', grade: 'sergent_autres_fonctions', is_active: true, avatar_url: null, ...extra,
});

// Simule la base selon la requête : compte GitHub connu ou non, courriel libre ou non
function base({ existant = null, courrielPris = false } = {}) {
  query.mockImplementation(async (sql, params) => {
    if (sql.includes('WHERE github_id')) return { rows: existant ? [existant] : [] };
    if (sql.includes('WHERE email')) return { rows: courrielPris ? [{ '?column?': 1 }] : [] };
    if (sql.includes('INSERT INTO app_user')) {
      return { rows: [compteGithub({ first_name: params[0], last_name: params[1], badge_number: params[2], email: params[3] })] };
    }
    throw new Error(`Requête inattendue : ${sql}`);
  });
}

// Retour de GitHub avec le même state dans l'adresse et dans le cookie
const retour = (state = 'abc', cookieState = state) =>
  request(app)
    .get(`/api/auth/github/callback?code=le-code&state=${state}`)
    .set('Cookie', `${STATE_COOKIE}=${cookieState}`);

describe('GET /api/auth/github', () => {
  test('redirige vers GitHub et pose le state dans un cookie httpOnly', async () => {
    github.authorizationUrl.mockReturnValue({ state: 'abc', url: 'https://github.com/login/oauth/authorize?state=abc' });

    const res = await request(app).get('/api/auth/github');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://github.com/login/oauth/authorize?state=abc');
    const cookie = cookieDe(res, STATE_COOKIE);
    expect(cookie).toContain(`${STATE_COOKIE}=abc`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth\/github/);
  });

  test('sans GITHUB_CLIENT_ID ni secret : retour à la connexion avec un message', async () => {
    github.isConfigured.mockReturnValue(false);

    const res = await request(app).get('/api/auth/github');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/connexion?erreur=github-non-configure');
    expect(github.authorizationUrl).not.toHaveBeenCalled();
  });
});

describe('GET /api/auth/github/callback', () => {
  test('première connexion : crée un compte policier sans mot de passe et ouvre la session', async () => {
    base();
    github.fetchProfile.mockResolvedValue(profilGithub);

    const res = await retour();

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/connexion?github=ok');
    expect(github.fetchProfile).toHaveBeenCalledWith('le-code');

    const insert = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO app_user'));
    expect(insert[0]).toMatch(/NULL, 'policier', 'sergent_autres_fonctions'/);
    expect(insert[1]).toEqual(['Ada', 'Lovelace', 'GH-4242', 'ada@example.com', 4242]);

    const session = cookieDe(res, COOKIE_NAME);
    expect(session).toMatch(/HttpOnly/i);
    const jeton = session.split(';')[0].slice(COOKIE_NAME.length + 1);
    expect(jwt.verify(jeton, 'test-secret')).toMatchObject({ id: 12, role: 'policier' });
    const csrfCookie = cookieDe(res, CSRF_COOKIE_NAME);
    expect(csrfCookie).not.toMatch(/HttpOnly/i);
    expect(verifyCsrfToken(csrfCookie.split(';')[0].slice(CSRF_COOKIE_NAME.length + 1))).toBe(true);
  });

  test('compte déjà lié : aucune création', async () => {
    base({ existant: compteGithub({ role: 'superviseur', grade: 'lieutenant' }) });
    github.fetchProfile.mockResolvedValue(profilGithub);

    const res = await retour();

    expect(res.headers.location).toBe('/connexion?github=ok');
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT'))).toBe(false);
  });

  test('courriel déjà utilisé par un autre compte : adresse noreply de GitHub', async () => {
    base({ courrielPris: true });
    github.fetchProfile.mockResolvedValue(profilGithub);

    await retour();

    const insert = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO app_user'));
    expect(insert[1][3]).toBe('4242+ada@users.noreply.github.com');
  });

  test('sans nom affiché ni courriel public : identifiant GitHub et adresse noreply', async () => {
    base();
    github.fetchProfile.mockResolvedValue({ id: 7, login: 'octocat', name: null, email: null });

    await retour();

    const insert = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO app_user'));
    expect(insert[1]).toEqual(['octocat', '', 'GH-7', '7+octocat@users.noreply.github.com', 7]);
  });

  test('state différent du cookie : refusé, GitHub n\'est pas appelé', async () => {
    const res = await retour('abc', 'autre');

    expect(res.headers.location).toBe('/connexion?erreur=github');
    expect(github.fetchProfile).not.toHaveBeenCalled();
    expect(cookieDe(res, COOKIE_NAME)).toBeUndefined();
  });

  test('sans cookie de state : refusé', async () => {
    const res = await request(app).get('/api/auth/github/callback?code=le-code&state=abc');

    expect(res.headers.location).toBe('/connexion?erreur=github');
    expect(github.fetchProfile).not.toHaveBeenCalled();
  });

  test('autorisation refusée sur GitHub : retour avec un message', async () => {
    const res = await request(app)
      .get('/api/auth/github/callback?error=access_denied&state=abc')
      .set('Cookie', `${STATE_COOKIE}=abc`);

    expect(res.headers.location).toBe('/connexion?erreur=github-annule');
  });

  test('compte désactivé : aucune session', async () => {
    base({ existant: compteGithub({ is_active: false }) });
    github.fetchProfile.mockResolvedValue(profilGithub);

    const res = await retour();

    expect(res.headers.location).toBe('/connexion?erreur=inactif');
    expect(cookieDe(res, COOKIE_NAME)).toBeUndefined();
  });

  test('échec de l\'échange avec GitHub : retour avec une erreur, sans session', async () => {
    github.fetchProfile.mockRejectedValue(new Error('bad_verification_code'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await retour();

    expect(res.headers.location).toBe('/connexion?erreur=github');
    expect(cookieDe(res, COOKIE_NAME)).toBeUndefined();
  });

  test('le compte GitHub reçoit le rôle policier : action de superviseur refusée', async () => {
    base();
    github.fetchProfile.mockResolvedValue(profilGithub);
    const session = cookieDe(await retour(), COOKIE_NAME).split(';')[0];
    const csrfToken = createCsrfToken();

    const res = await request(app)
      .post('/api/users')
      .set('Cookie', `${session}; ${CSRF_COOKIE_NAME}=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({});

    expect(res.status).toBe(403);
  });
});

describe('Compte GitHub et mot de passe', () => {
  test('connexion par matricule refusée (pas de mot de passe)', async () => {
    query.mockResolvedValueOnce({ rows: [{ ...compteGithub(), password_hash: null }] });

    const res = await request(app).post('/api/auth/login').send({ badge_number: 'GH-4242', password: 'nimporte' });

    expect(res.status).toBe(401);
  });

  test('changement de mot de passe refusé avec un message clair', async () => {
    query.mockResolvedValueOnce({ rows: [{ password_hash: null }] });
    const jeton = jwt.sign({ id: 12, role: 'policier' }, 'test-secret');

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${jeton}`)
      .send({ old_password: 'ancien-mdp', new_password: 'nouveau-mdp' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/GitHub/);
  });
});
