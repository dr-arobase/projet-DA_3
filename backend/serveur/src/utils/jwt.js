import jwt from 'jsonwebtoken';

/** Durée d'une session : un quart de travail. */
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error('La variable d\'environnement JWT_SECRET est requise.');
  return value;
}

export function signSession(user) {
  return jwt.sign({ sub: user.id, role: user.role }, secret(), { expiresIn: SESSION_DURATION_MS / 1000 });
}

/** Le contenu du jeton, ou null s'il est invalide ou expiré. */
export function verifySession(token) {
  const key = secret();
  try {
    return jwt.verify(token, key);
  } catch {
    return null;
  }
}
