import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { assertJwtSecret } from './jwt.js';

const signatureFor = (nonce) => createHmac('sha256', process.env.JWT_SECRET)
  .update(`csrf-token:${nonce}`)
  .digest('base64url');

export function createCsrfToken() {
  assertJwtSecret();
  const nonce = randomBytes(32).toString('base64url');
  return `${nonce}.${signatureFor(nonce)}`;
}

export function verifyCsrfToken(token) {
  assertJwtSecret();
  if (typeof token !== 'string') return false;

  const [nonce, signature, extra] = token.split('.');
  if (extra !== undefined || !nonce || !signature) return false;

  const expected = Buffer.from(signatureFor(nonce));
  const provided = Buffer.from(signature);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
