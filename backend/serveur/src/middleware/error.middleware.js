// Middleware global de gestion des erreurs.
// Le détail d'une erreur (chemin de fichier, requête SQL, pile d'appels) ne sort jamais vers
// le navigateur : il ne va que dans la console du serveur, et seulement pour une vraie panne (5xx).

// Message générique d'une erreur dont le texte n'est pas fait pour le client (expose === false),
// par exemple « ENOENT: no such file or directory, stat 'C:\...' » d'un fichier absent
const MESSAGES = {
  400: 'Requête invalide',
  401: 'Authentification requise',
  403: 'Accès refusé',
  404: 'Ressource introuvable',
  413: 'Contenu trop volumineux',
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    console.error(err);
    return res.status(status).json({ message: 'Erreur serveur' });
  }

  // Erreur du client (4xx) : normale, pas journalisée; texte d'origine seulement s'il est prévu pour lui
  // Requête trop grosse (body-parser) : son texte est en anglais, on renvoie le nôtre
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Le contenu envoyé est trop volumineux (1 Mo au plus).' });
  }
  const message = err.expose === false || !err.message ? (MESSAGES[status] ?? 'Requête invalide') : err.message;
  return res.status(status).json({ message });
};
