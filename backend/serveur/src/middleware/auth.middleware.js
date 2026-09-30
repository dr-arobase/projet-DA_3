import { verifyToken as verifyJwt } from '../utils/jwt.js';
import { tokenFrom } from '../utils/session.js';

export const verifyToken = (req, res, next) => {
  // En-tête « Bearer TOKEN » ou cookie de session posé au login
  const token = tokenFrom(req.headers);

  if (!token) {
    return res.status(401).json({ message: 'Accès refusé. Aucun jeton fourni.' });
  }

  try {
    const decoded = verifyJwt(token);
    
    // Attache les informations de l'agent connecté à la requête
    req.user = decoded; 
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Jeton invalide ou expiré.' });
  }
};