import jwt from 'jsonwebtoken';

// Un seul endroit pour le secret : l'API (login, middleware) et Socket.IO
// doivent signer et vérifier les jetons avec la même clé.
export function assertJwtSecret() {
  if (!process.env.JWT_SECRET?.trim()) {
    throw new Error('JWT_SECRET doit être définie avec une valeur non vide.');
  }
}

function getSecret() {
  assertJwtSecret();
  return process.env.JWT_SECRET;
}

export function signToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: '8h' });
}

export function verifyToken(token) {
  return jwt.verify(token, getSecret());
}
