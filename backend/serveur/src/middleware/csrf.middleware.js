import {
  COOKIE_NAME, CSRF_COOKIE_NAME, csrfCookieOptions, readCookie,
} from '../utils/session.js';
import { createCsrfToken, verifyCsrfToken } from '../utils/csrf.js';
import { getAllowedOrigins } from '../utils/allowed-origins.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function verifyCsrf(req, res, next) {
  if (!SAFE_METHODS.has(req.method)) {
    const origin = req.headers.origin;
    if (origin && !getAllowedOrigins().includes(origin)) {
      return res.status(403).json({ message: 'Origine non autorisée.' });
    }
  }

  if (SAFE_METHODS.has(req.method)) {
    const sessionToken = readCookie(req.headers.cookie, COOKIE_NAME);
    const csrfToken = readCookie(req.headers.cookie, CSRF_COOKIE_NAME);
    if (sessionToken && !verifyCsrfToken(csrfToken)) {
      res.cookie(CSRF_COOKIE_NAME, createCsrfToken(), csrfCookieOptions());
    }
    return next();
  }

  const authorization = req.headers.authorization || '';
  if (/^Bearer\s+\S+$/.test(authorization)) return next();
  if (!readCookie(req.headers.cookie, COOKIE_NAME)) return next();

  const csrfCookie = readCookie(req.headers.cookie, CSRF_COOKIE_NAME);
  const csrfHeader = req.headers['x-csrf-token'];
  if (!csrfCookie || csrfCookie !== csrfHeader || !verifyCsrfToken(csrfCookie)) {
    return res.status(403).json({ message: 'Jeton CSRF manquant ou invalide.' });
  }
  return next();
}
