/** Refuse (403) la requête si le rôle du compte connecté n'est pas dans `roles`. */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Accès refusé : votre rôle ne permet pas cette action.' });
    }
    return next();
  };
}
