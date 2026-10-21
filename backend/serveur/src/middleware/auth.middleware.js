import { verifyToken as verifyJwt } from '../utils/jwt.js';
import { tokenFrom } from '../utils/session.js';
import { getAccountAuthInfo } from '../utils/account-status.js';
import { verifyCsrf } from './csrf.middleware.js';

export const verifyToken = async (req, res, next) => {
  // En-tête « Bearer TOKEN » ou cookie de session posé au login
  const token = tokenFrom(req.headers);

  if (!token) {
    return res.status(401).json({ message: 'Accès refusé. Aucun jeton fourni.' });
  }

  try {
    const decoded = verifyJwt(token);

    const account = await getAccountAuthInfo(decoded.id);
    if (!account?.is_active) {
      return res.status(401).json({ message: 'Compte désactivé.' });
    }

    // Attache les informations de l'agent connecté à la requête
    req.user = {
      id: account.id,
      badge_number: account.badge_number,
      role: account.role,
      grade: account.grade,
    };
    return verifyCsrf(req, res, next);
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.name === 'NotBeforeError') {
      return res.status(403).json({ message: 'Jeton invalide ou expiré.' });
    }
    return next(error);
  }
};