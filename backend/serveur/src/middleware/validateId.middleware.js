// Valide les identifiants numériques de l'URL (:id, :userId, :groupId...).
// À brancher avec router.param('id', validateId) : Express l'appelle pour
// chaque route du routeur qui contient ce paramètre.
// /api/criminals/abc, /api/users/0 ou /api/users/1.5 donnent 400 au lieu
// d'atteindre la base (où ils causeraient une erreur 500).

const MAX_INT = 2147483647; // plus grand INTEGER / SERIAL de PostgreSQL

export function validateId(req, res, next, value, name) {
  if (!/^[1-9]\d*$/.test(value) || Number(value) > MAX_INT) {
    return res.status(400).json({ message: `Identifiant invalide : ${name} doit être un entier positif` });
  }
  next();
}