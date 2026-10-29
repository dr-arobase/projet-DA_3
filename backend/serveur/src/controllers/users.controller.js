import * as userService from '../services/users.service.js';

const VALID_ROLES = ['policier', 'superviseur', 'direction'];
const VALID_GRADES = [
  'sergent_autres_fonctions', 'sergent_gestionnaire', 'sergent_responsable_de_poste',
  'lieutenant', 'capitaine', 'inspecteur', 'inspecteur_chef',
  'directeur_general_adjoint', 'directeur_general'
];


// Le contrôleur lit la requête et répond ; la logique est dans users.service.js.
// Les erreurs prévues du service portent un statusCode (400, 403, 404, 409) ;
// toute autre erreur est une panne serveur.
const handleError = (res, error, context) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  console.error(`Erreur lors ${context}:`, error);
  return res.status(500).json({ message: 'Erreur serveur' });
};

// GET /api/users
export const getUsers = async (req, res) => {
  try {
    return res.json(await userService.listUsers());
  } catch (error) {
    return handleError(res, error, 'de la récupération des utilisateurs');
  }
};

// GET /api/users/:id
export const getUserById = async (req, res) => {
  try {
    return res.json(await userService.getUserById(req.params.id));
  } catch (error) {
    return handleError(res, error, 'de la récupération de l\'utilisateur');
  }
};

// POST /api/users : les superviseurs créent des comptes policiers, la direction peut créer tout rôle
export const createUser = async (req, res) => {
  const { first_name, last_name, badge_number, email, password, role, grade } = req.body;

  if (!first_name || !last_name || !badge_number || !email || !password) {
    return res.status(400).json({ message: 'first_name, last_name, badge_number, email et password sont obligatoires' });
  }

  const finalRole = role || 'policier';
  const finalGrade = grade || 'sergent_autres_fonctions';

  if (!VALID_ROLES.includes(finalRole)) {
    return res.status(400).json({ message: `Rôle invalide. Rôles autorisés : ${VALID_ROLES.join(', ')}` });
  }
  if (req.user.role === 'superviseur' && finalRole !== 'policier') {
    return res.status(403).json({ message: 'Seule la direction peut créer des comptes de superviseur ou de direction.' });
  }
  if (!VALID_GRADES.includes(finalGrade)) {
    return res.status(400).json({ message: `Grade invalide. Grades autorisés : ${VALID_GRADES.join(', ')}` });
  }

  try {
    const user = await userService.createUser(req.body, req.user);
    return res.status(201).json({ message: 'Compte créé avec succès', user });
  } catch (error) {
    return handleError(res, error, 'de la création de l\'utilisateur');
  }
};

// PATCH /api/users/:id/deactivate
export const deactivateUser = async (req, res) => {
  try {
    const user = await userService.deactivateUser(req.params.id, req.user);
    return res.json({ message: 'Compte désactivé', user });
  } catch (error) {
    return handleError(res, error, 'de la désactivation');
  }
};

// PATCH /api/users/:id/reactivate
export const reactivateUser = async (req, res) => {
  try {
    const user = await userService.setUserActive(req.params.id, true, req.user.id);
    return res.json({ message: 'Compte réactivé', user });
  } catch (error) {
    return handleError(res, error, 'de la réactivation');
  }
};

// PATCH /api/users/:id/promote
export const promoteUser = async (req, res) => {
  try {
    const user = await userService.promoteUser(req.params.id, req.body, req.user.id);
    return res.json({ message: 'Utilisateur promu', user });
  } catch (error) {
    return handleError(res, error, 'de la promotion');
  }
};