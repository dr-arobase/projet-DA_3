const LEVELS = { policier: 1, superviseur: 2, direction: 3 };
// laisse passer un superviseur ou la direction, et refuse un policier.
export function requireRole(minRole) {
  return (req, res, next) => {
    const level = LEVELS[req.user?.role] ?? 0;
    if (level < LEVELS[minRole]) {
      return res.status(403).json({ message: 'Accès refusé : rôle insuffisant' });
    }
    next();
  };
}
