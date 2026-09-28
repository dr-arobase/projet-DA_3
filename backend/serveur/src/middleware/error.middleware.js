import { logger } from '../utils/logger.js';

/** Route d'API inconnue : 404 en JSON. */
export function apiNotFound(req, res) {
  res.status(404).json({ message: `Route inconnue : ${req.method} ${req.originalUrl}` });
}

/**
 * Dernier recours : corps JSON illisible (400) ou erreur imprévue (500, journalisée).
 * Express reconnaît un gestionnaire d'erreurs à ses quatre paramètres : `next` doit rester.
 */
export function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Le corps de la requête n\'est pas du JSON valide.' });
  }
  logger.error(`${req.method} ${req.originalUrl}`, err);
  return res.status(500).json({ message: 'Erreur interne du serveur. Réessayez plus tard.' });
}
