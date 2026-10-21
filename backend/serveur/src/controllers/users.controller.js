import bcrypt from 'bcrypt';
import * as userModel from '../models/user.model.js';
import * as auditLogModel from '../models/auditLog.model.js';

const VALID_ROLES = ['policier', 'superviseur', 'direction'];
// Grades permis pour chaque rôle (docs/03-conception.md, « Contraintes de rôle »)
const GRADES_BY_ROLE = {
  policier: ['sergent_autres_fonctions'],
  superviseur: [
    'sergent_gestionnaire', 'sergent_responsable_de_poste', 'lieutenant',
    'capitaine', 'inspecteur', 'inspecteur_chef'
  ],
  direction: ['directeur_general_adjoint', 'directeur_general']
};
const VALID_GRADES = Object.values(GRADES_BY_ROLE).flat();

// Vrai si le grade fait partie des grades permis pour ce rôle
const gradeMatchesRole = (role, grade) => GRADES_BY_ROLE[role]?.includes(grade) ?? false;
const gradeMismatchMessage = (role) =>
  `Ce grade ne correspond pas au rôle ${role}. Grades permis : ${GRADES_BY_ROLE[role].join(', ')}`;

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

// POST /api/users : créer un compte
// Un superviseur ne crée que des policiers ; la direction peut créer tous les rôles.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;
const MAX_LENGTHS = { first_name: 100, last_name: 100, badge_number: 20, email: 255 };

// Doublon refusé par la base (deux créations en même temps) : PostgreSQL ou SQLite
const isUniqueViolation = (error) =>
  error?.code === '23505' || /UNIQUE constraint failed/i.test(error?.message ?? '');

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

export const createUser = async (req, res) => {
  const body = req.body ?? {};
  const first_name = clean(body.first_name);
  const last_name = clean(body.last_name);
  const badge_number = clean(body.badge_number);
  const email = clean(body.email).toLowerCase();
  const { password, role, grade } = body;

  if (!first_name || !last_name || !badge_number || !email || !password) {
    return res.status(400).json({ message: 'first_name, last_name, badge_number, email et password sont obligatoires' });
  }

  const fields = { first_name, last_name, badge_number, email };
  for (const [field, max] of Object.entries(MAX_LENGTHS)) {
    if (fields[field].length > max) {
      return res.status(400).json({ message: `Le champ ${field} ne doit pas dépasser ${max} caractères` });
    }
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: 'Le courriel est invalide' });
  }
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return res.status(400).json({ message: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères` });
  }

    const finalRole = role || 'policier';

  if (!VALID_ROLES.includes(finalRole)) {
    return res.status(400).json({ message: `Rôle invalide. Rôles autorisés : ${VALID_ROLES.join(', ')}` });
  }
  if (req.user.role === 'superviseur' && finalRole !== 'policier') {
    return res.status(403).json({ message: 'Un superviseur ne peut créer que des comptes policier' });
  }
  // Sans grade, on prend le premier grade du rôle (sergent_autres_fonctions pour un policier)
  const finalGrade = grade || GRADES_BY_ROLE[finalRole][0];
  if (!VALID_GRADES.includes(finalGrade)) {
    return res.status(400).json({ message: `Grade invalide. Grades autorisés : ${VALID_GRADES.join(', ')}` });
  }
  if (!gradeMatchesRole(finalRole, finalGrade)) {
    return res.status(400).json({ message: gradeMismatchMessage(finalRole) });
  }

  try {
    if (await userModel.findByBadge(badge_number)) {
      return res.status(409).json({ message: 'Ce matricule existe déjà' });
    }
    if (await userModel.emailExists(email)) {
      return res.status(409).json({ message: 'Ce courriel est déjà utilisé' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const newUser = await userModel.create({
      first_name, last_name, badge_number, email, password_hash, role: finalRole, grade: finalGrade
    });

    return res.status(201).json({ message: 'Compte créé avec succès', user: newUser });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return res.status(409).json({ message: 'Ce matricule ou ce courriel est déjà utilisé' });
    }
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
        action: 'USER_REACTIVATED',
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
    // Le grade est validé avant de modifier le rôle : un policier lieutenant est refusé
  if (!gradeMatchesRole(role, grade)) {
    return res.status(400).json({ message: gradeMismatchMessage(role) });
  }

  try {
    const user = await userModel.promote(req.params.id, { role, grade });
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    
    await auditLogModel.record({
        actor_id: req.user.id,
        action: 'USER_PROMOTED',
        target_type:'user',
        target_id: user.id
    });
    
    return res.json({ message: 'Utilisateur promu', user });
  } catch (error) {
    console.error('Erreur lors de la promotion:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

