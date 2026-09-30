import bcrypt from 'bcrypt';
import { signToken } from '../utils/jwt.js';
import { pool as db } from '../config/db.js';

export const loginUser = async (badge_number, password) => {
  // 1. Recherche de l'utilisateur actif dans app_user
  const result = await db.query(
    'SELECT id, first_name, last_name, badge_number, password_hash, role, grade FROM app_user WHERE badge_number = $1 AND is_active = true',
    [badge_number]
  );

  if (result.rows.length === 0) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const user = result.rows[0];

  // 2. Vérification du mot de passe avec bcrypt
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new Error('INVALID_CREDENTIALS');
  }

  // 3. Génération du jeton JWT
  const token = signToken({
    id: user.id,
    badge_number: user.badge_number,
    role: user.role,
    grade: user.grade
  });

  // 4. Retour des données structurées
  return {
    message: 'Connexion réussie',
    token,
    user: {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      badge_number: user.badge_number,
      role: user.role,
      grade: user.grade
    }
  };
};

export const logoutUser = async (userId) => {
  // Les tokens JWT sont stateless (sans état côté serveur).
  // La déconnexion valide que l'agent est authentifié et lui indique de supprimer le token.
  return {
    message: 'Déconnexion réussie. Le jeton doit être supprimé côté client.'
  };
};