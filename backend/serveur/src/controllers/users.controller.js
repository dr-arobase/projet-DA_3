import bcrypt from 'bcrypt';
import * as userModel from '../models/user.model.js';
import * as auditLogModel from '../models/auditLog.model.js';

const VALID_ROLES = ['policier', 'superviseur', 'direction'];
const VALID_GRADES = [
  'sergent_autres_fonctions', 'sergent_gestionnaire', 'sergent_responsable_de_poste',
  'lieutenant', 'capitaine', 'inspecteur', 'inspecteur_chef',
  'directeur_general_adjoint', 'directeur_general'
];

// GET /api/users
export const getUsers = async (req, res) => {
  try {
    const users = await userModel.findAll();
    return res.json(users);
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// GET /api/users/:id
export const getUserById = async (req, res) => {
  try {
    const user = await userModel.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    return res.json(user);
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// POST /api/users : créer un compte policier
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
  if (!VALID_GRADES.includes(finalGrade)) {
    return res.status(400).json({ message: `Grade invalide. Grades autorisés : ${VALID_GRADES.join(', ')}` });
  }

  try {
    const existing = await userModel.findByBadge(badge_number);
    if (existing) {
      return res.status(409).json({ message: 'Ce matricule existe déjà' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const newUser = await userModel.create({
      first_name, last_name, badge_number, email, password_hash, role: finalRole, grade: finalGrade
    });

    return res.status(201).json({ message: 'Compte créé avec succès', user: newUser });
  } catch (error) {
    console.error('Erreur lors de la création de l\'utilisateur:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// PATCH /api/users/:id/deactivate
export const deactivateUser = async (req, res) => {
  try {
        const user = await userModel.setActive(req.params.id, false);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

    await auditLogModel.record({
      actor_id: req.user.id,
      action: 'USER_DEACTIVATED',
      target_type: 'user',
      target_id: user.id
    });

    return res.json({ message: 'Compte désactivé', user });
  } catch (error) {
    console.error('Erreur lors de la désactivation:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// PATCH /api/users/:id/reactivate
export const reactivateUser = async (req, res) => {
  try {
    const user = await userModel.setActive(req.params.id, true);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    
    await auditLogModel.record({
        actor_id: req.user.id,
        action: 'USER_DEACTIVATED',
        target_type:'user',
        target_id: user.id
    });

    return res.json({ message: 'Compte réactivé', user });
  } catch (error) {
    console.error('Erreur lors de la réactivation:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// PATCH /api/users/:id/promote
export const promoteUser = async (req, res) => {
  const { role, grade } = req.body;

  if (!role || !grade) {
    return res.status(400).json({ message: 'role et grade sont obligatoires' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ message: `Rôle invalide. Rôles autorisés : ${VALID_ROLES.join(', ')}` });
  }
  if (!VALID_GRADES.includes(grade)) {
    return res.status(400).json({ message: `Grade invalide. Grades autorisés : ${VALID_GRADES.join(', ')}` });
  }

  try {
    const user = await userModel.promote(req.params.id, { role, grade });
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    
    await auditLogModel.record({
        actor_id: req.user.id,
        action: 'USER_DEACTIVATED',
        target_type:'user',
        target_id: user.id
    });
    
    return res.json({ message: 'Utilisateur promu', user });
  } catch (error) {
    console.error('Erreur lors de la promotion:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};