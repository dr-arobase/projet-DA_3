import { jest, describe, test, expect } from '@jest/globals';

process.env.JWT_SECRET = 'test-secret';

const { verifyCsrf } = await import('../../src/middleware/csrf.middleware.js');
const { createCsrfToken, verifyCsrfToken } = await import('../../src/utils/csrf.js');
const { COOKIE_NAME, CSRF_COOKIE_NAME } = await import('../../src/utils/session.js');

function run(method, headers = {}) {
  const req = { method, headers };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  res.cookie = jest.fn();
  const next = jest.fn();
  verifyCsrf(req, res, next);
  return { res, next };
}

describe('protection CSRF', () => {
  test('valide les jetons signés et rejette les jetons falsifiés', () => {
    const token = createCsrfToken();

    expect(verifyCsrfToken(token)).toBe(true);
    expect(verifyCsrfToken(`${token}x`)).toBe(false);
    expect(verifyCsrfToken('sans-signature')).toBe(false);
    expect(verifyCsrfToken(undefined)).toBe(false);
  });

  test.each(['GET', 'HEAD', 'OPTIONS'])('%s ne nécessite pas de jeton CSRF', (method) => {
    const { res, next } = run(method, { cookie: `${COOKIE_NAME}=session` });

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledWith(
      CSRF_COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({ httpOnly: false, sameSite: 'lax' })
    );
  });

  test('les appels sans cookie de session ne nécessitent pas de jeton CSRF', () => {
    const { next, res } = run('POST');

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('un client Bearer reste utilisable même si un cookie de session est présent', () => {
    const { next, res } = run('PATCH', {
      authorization: 'Bearer acces-par-entete',
      cookie: `${COOKIE_NAME}=session`,
    });

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test.each([
    ['jeton manquant', {}],
    ['jetons différents', { 'x-csrf-token': 'autre-jeton' }],
  ])('refuse un cookie de session avec un %s', (_description, extraHeaders) => {
    const csrfToken = createCsrfToken();
    const { next, res } = run('POST', {
      cookie: `${COOKIE_NAME}=session; ${CSRF_COOKIE_NAME}=${csrfToken}`,
      ...extraHeaders,
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Jeton CSRF manquant ou invalide.' });
  });

  test('accepte un jeton CSRF signé identique dans le cookie et l’en-tête', () => {
    const csrfToken = createCsrfToken();
    const { next, res } = run('DELETE', {
      cookie: `${COOKIE_NAME}=session; ${CSRF_COOKIE_NAME}=${csrfToken}`,
      'x-csrf-token': csrfToken,
    });

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
