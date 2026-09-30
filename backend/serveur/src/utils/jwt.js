import jwt from 'jsonwebtoken';

// Un seul endroit pour le secret : l'API (login, middleware) et Socket.IO
// doivent signer et vérifier les jetons avec la même clé.
function getSecret() {
  return process.env.JWT_SECRET || 'super_secret_key_change_me';
}

export function signToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: '8h' });
}

export function verifyToken(token) {
  return jwt.verify(token, getSecret());
}
