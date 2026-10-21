import * as userService from '../services/users.service.js';

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

// POST /api/users : créer un compte
export const createUser = async (req, res) => {
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
    const user = await userService.setUserActive(req.params.id, false, req.user.id);
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