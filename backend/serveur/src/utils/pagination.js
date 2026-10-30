// Lit ?page= et ?limit= de l'URL pour une liste paginée.
// - page : 1 par défaut ; une page nulle, négative ou qui n'est pas un nombre devient 1
// - limit : la valeur par défaut de la liste ; plafonnée à MAX_LIMIT et au moins 1
// Ainsi ?limit=100000 ne vide pas la base d'un coup et ?page=-3 ne donne pas un OFFSET négatif.

export const MAX_LIMIT = 100;

export function readPagination(query = {}, defaultLimit = 20) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), MAX_LIMIT);
  return { page, limit, offset: (page - 1) * limit };
}