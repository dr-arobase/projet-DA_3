import bcrypt from 'bcrypt';
import * as userModel from '../models/user.model.js';
import * as auditLogModel from '../models/auditLog.model.js';
import { publishAccountDeactivated } from '../utils/account-status.js';
import { disconnectUser } from '../sockets/index.js';

// Logique métier des comptes. Les erreurs prévues portent un statusCode (400, 403, 404, 409) ;
// le contrôleur les traduit en réponse HTTP, comme pour les dossiers (criminals.service.js).

export const VALID_ROLES = ['policier', 'superviseur', 'direction'];

// Grades permis pour chaque rôle (docs/03-conception.md, « Contraintes de rôle »)
export const GRADES_BY_ROLE = {
  policier: ['sergent_autres_fonctions'],
  superviseur: [
    'sergent_gestionnaire', 'sergent_responsable_de_poste', 'lieutenant',
    'capitaine', 'inspecteur', 'inspecteur_chef'
  ],
  direction: ['directeur_general_adjoint', 'directeur_general']
};
export const VALID_GRADES = Object.values(GRADES_BY_ROLE).flat();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;
const MAX_LENGTHS = { first_name: 100, last_name: 100, badge_number: 20, email: 255 };

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const notFound = () => httpError(404, 'Utilisateur non trouvé');

// Doublon refusé par la base (deux créations en même temps) : PostgreSQL ou SQLite
const isUniqueViolation = (error) =>
  error?.code === '23505' || /UNIQUE constraint failed/i.test(error?.message ?? '');

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

// Rôle connu et grade permis pour ce rôle ; sinon 400
function checkRoleAndGrade(role, grade) {
  if (!VALID_ROLES.includes(role)) {
    throw httpError(400, `Rôle invalide. Rôles autorisés : ${VALID_ROLES.join(', ')}`);
  }
  if (!VALID_GRADES.includes(grade)) {
    throw httpError(400, `Grade invalide. Grades autorisés : ${VALID_GRADES.join(', ')}`);
  }
  if (!GRADES_BY_ROLE[role].includes(grade)) {
    throw httpError(400, `Ce grade ne correspond pas au rôle ${role}. Grades permis : ${GRADES_BY_ROLE[role].join(', ')}`);
  }
}

export const listUsers = () => userModel.findAll();

export const getUserById = async (id) => {
  const user = await userModel.findById(id);
  if (!user) throw notFound();
  return user;
};

// Créer un compte. Un superviseur ne crée que des policiers ; la direction peut créer tous les rôles.
export const createUser = async (data = {}, actor) => {
  const first_name = clean(data.first_name);
  const last_name = clean(data.last_name);
  const badge_number = clean(data.badge_number);
  const email = clean(data.email).toLowerCase();
  const { password } = data;

  if (!first_name || !last_name || !badge_number || !email || !password) {
    throw httpError(400, 'first_name, last_name, badge_number, email et password sont obligatoires');
  }

  const fields = { first_name, last_name, badge_number, email };
  for (const [field, max] of Object.entries(MAX_LENGTHS)) {
    if (fields[field].length > max) {
      throw httpError(400, `Le champ ${field} ne doit pas dépasser ${max} caractères`);
    }
  }

  if (!EMAIL_REGEX.test(email)) {
    throw httpError(400, 'Le courriel est invalide');
  }
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    throw httpError(400, `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`);
  }

  const role = data.role || 'policier';
  if (!VALID_ROLES.includes(role)) {
    throw httpError(400, `Rôle invalide. Rôles autorisés : ${VALID_ROLES.join(', ')}`);
  }
  if (actor.role === 'superviseur' && role !== 'policier') {
    throw httpError(403, 'Un superviseur ne peut créer que des comptes policier');
  }
  // Sans grade, on prend le premier grade du rôle (sergent_autres_fonctions pour un policier)
  const grade = data.grade || GRADES_BY_ROLE[role][0];
  checkRoleAndGrade(role, grade);

  if (await userModel.findByBadge(badge_number)) {
    throw httpError(409, 'Ce matricule existe déjà');
  }
  if (await userModel.emailExists(email)) {
    throw httpError(409, 'Ce courriel est déjà utilisé');
  }

  const password_hash = await bcrypt.hash(password, 10);
  try {
    return await userModel.create({ first_name, last_name, badge_number, email, password_hash, role, grade });
  } catch (error) {
    if (isUniqueViolation(error)) throw httpError(409, 'Ce matricule ou ce courriel est déjà utilisé');
    throw error;
  }
};

// Désactiver un compte; un superviseur ne peut ni se désactiver ni désactiver la direction.
export const deactivateUser = async (id, actor) => {
  if (Number(id) === Number(actor.id)) {
    throw httpError(403, 'Vous ne pouvez pas désactiver votre propre compte.');
  }

  const user = await userModel.deactivate(id, actor.role);
  if (!user) {
    const target = await userModel.findById(id);
    if (!target) throw notFound();
    if (actor.role === 'superviseur' && target.role === 'direction') {
      throw httpError(403, 'Un superviseur ne peut pas désactiver un compte de direction.');
    }
    throw notFound();
  }

  disconnectUser(user.id);
  await publishAccountDeactivated(user.id);
  await auditLogModel.record({
    actor_id: actor.id,
    action: 'USER_DEACTIVATED',
    target_type: 'user',
    target_id: user.id
  });
  return user;
};

// Réactiver un compte, avec une entrée au journal d'audit
export const setUserActive = async (id, isActive, actorId) => {
  const user = await userModel.setActive(id, isActive);
  if (!user) throw notFound();

  await auditLogModel.record({
    actor_id: actorId,
    action: isActive ? 'USER_REACTIVATED' : 'USER_DEACTIVATED',
    target_type: 'user',
    target_id: user.id
  });
  return user;
};

// Changer le rôle et le grade. Le grade est validé avant de modifier le rôle :
// un policier lieutenant est refusé.
export const promoteUser = async (id, { role, grade } = {}, actorId) => {
  if (!role || !grade) {
    throw httpError(400, 'role et grade sont obligatoires');
  }
  checkRoleAndGrade(role, grade);

  const user = await userModel.promote(id, { role, grade });
  if (!user) throw notFound();

  await auditLogModel.record({
    actor_id: actorId,
    action: 'USER_PROMOTED',
    target_type: 'user',
    target_id: user.id
  });
  return user;
};