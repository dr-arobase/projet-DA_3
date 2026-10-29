import bcrypt from 'bcrypt';
import * as userModel from '../models/user.model.js';
import * as auditLogModel from '../models/auditLog.model.js';
import { publishAccountDeactivated } from '../utils/account-status.js';
import { disconnectUser } from '../sockets/index.js';
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
    if (Number(req.params.id) === Number(req.user.id)) {
      return res.status(403).json({ message: 'Vous ne pouvez pas désactiver votre propre compte.' });
    }

    const user = await userModel.deactivate(req.params.id, req.user.role);
    if (!user) {
      const target = await userModel.findById(req.params.id);
      if (!target) return res.status(404).json({ message: 'Utilisateur non trouvé' });
      if (req.user.role === 'superviseur' && target.role === 'direction') {
        return res.status(403).json({ message: 'Un superviseur ne peut pas désactiver un compte de direction.' });
      }
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    disconnectUser(user.id);
    await publishAccountDeactivated(user.id);

    await auditLogModel.record({
      actor_id: req.user.id,
      action: 'USER_DEACTIVATED',
      target_type: 'user',
      target_id: user.id
    });

    const user = await userService.setUserActive(req.params.id, false, req.user.id);
    return res.json({ message: 'Compte désactivé', user });
  } catch (error) {
    return handleError(res, error, 'de la désactivation');
  }
};

// PATCH /api/users/:id/reactivate
export const reactivateUser = async (req, res) => {
  try {
    const user = await userModel.setActive(req.params.id, true);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

    await auditLogModel.record({
      actor_id: req.user.id,
      action: 'USER_REACTIVATED',
      target_type: 'user',
      target_id: user.id
    });

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