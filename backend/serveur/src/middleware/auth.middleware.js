import { verifyToken } from '../utils/jwt.js';

export function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Jeton manquant' });
  }
  try {
    const { id, badge_number, role, grade } = verifyToken(token);
    req.user = { id, badge_number, role, grade };
    next();
  } catch {
    return res.status(401).json({ message: 'Jeton invalide ou expiré' });
  }
}