import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
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
  const jwtSecret = process.env.JWT_SECRET || 'super_secret_key_change_me';
  const token = jwt.sign(
    {
      id: user.id,
      badge_number: user.badge_number,
      role: user.role,
      grade: user.grade
    },
    jwtSecret,
    { expiresIn: '8h' }
  );

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