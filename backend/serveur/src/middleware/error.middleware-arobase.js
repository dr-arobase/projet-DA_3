// Middleware global de gestion des erreurs
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  console.error(err);
  const status = err.status || err.statusCode || 500;
  return res.status(status).json({ message: err.message || 'Erreur serveur' });
};
