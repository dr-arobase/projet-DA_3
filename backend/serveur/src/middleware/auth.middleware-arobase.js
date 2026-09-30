import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extraction du token du format "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ message: 'Accès refusé. Aucun jeton fourni.' });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'super_secret_key_change_me';
    const decoded = jwt.verify(token, jwtSecret);
    
    // Attache les informations de l'agent connecté à la requête
    req.user = decoded; 
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Jeton invalide ou expiré.' });
  }
};