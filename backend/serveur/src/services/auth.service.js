import bcrypt from 'bcrypt';
import { signToken } from '../utils/jwt.js';
import * as userModel from '../models/user.model.js';
import { pool as db } from '../config/db.js';
import { AVATARS_DIR, AVATARS_URL, AVATAR_TYPES, isImage } from '../middleware/upload.middleware.js';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';

export const loginUser = async (badge_number, password) => {
  // 1. Recherche de l'utilisateur actif dans app_user
  const result = await db.query(
    'SELECT id, first_name, last_name, badge_number, password_hash, role, grade, avatar_url FROM app_user WHERE badge_number = $1 AND is_active = true',
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
      grade: user.grade,
      avatar_url: user.avatar_url ?? null
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

// Profil de l'agent connecté, relu en base : un compte désactivé depuis la
// connexion perd sa session même si son jeton n'a pas encore expiré.
export const getCurrentUser = async (userId) => {
  const user = await userModel.findById(userId);
  if (!user || !user.is_active) {
    throw new Error('INVALID_CREDENTIALS');
  }
  return publicProfile(user);
};

const publicProfile = ({ id, first_name, last_name, badge_number, email, role, grade, avatar_url, created_at }) =>
  ({ id, first_name, last_name, badge_number, email, role, grade, avatar_url, created_at });

// Changement de mot de passe par l'agent lui-même (page Mon profil) :
// l'ancien mot de passe doit être confirmé avant d'enregistrer le nouveau.
export const changePassword = async (userId, oldPassword, newPassword) => {
  const result = await db.query(
    'SELECT password_hash FROM app_user WHERE id = $1 AND is_active = true',
    [userId]
  );
  if (result.rows.length === 0) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const isPasswordValid = await bcrypt.compare(oldPassword, result.rows[0].password_hash);
  if (!isPasswordValid) {
    throw new Error('WRONG_PASSWORD');
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await db.query('UPDATE app_user SET password_hash = $1 WHERE id = $2', [newHash, userId]);
  return { message: 'Mot de passe mis à jour' };
};

// Photo de profil de l'agent connecté. Le fichier précédent est supprimé.
export const setAvatar = async (userId, contentType, data) => {
  if (!isImage(contentType, data)) {
    throw new Error('INVALID_IMAGE');
  }

  const current = await userModel.findById(userId);
  if (!current || !current.is_active) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const fileName = `${userId}-${Date.now()}.${AVATAR_TYPES[contentType]}`;
  await mkdir(AVATARS_DIR, { recursive: true });
  await writeFile(path.join(AVATARS_DIR, fileName), data);

  const user = await userModel.setAvatar(userId, `${AVATARS_URL}/${fileName}`);
  await removeAvatarFile(current.avatar_url);
  return publicProfile(user);
};

export const removeAvatar = async (userId) => {
  const current = await userModel.findById(userId);
  if (!current || !current.is_active) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const user = await userModel.setAvatar(userId, null);
  await removeAvatarFile(current.avatar_url);
  return publicProfile(user);
};

async function removeAvatarFile(avatarUrl) {
  if (!avatarUrl?.startsWith(`${AVATARS_URL}/`)) return;
  // basename : le nom vient de la base, on refuse tout chemin qui sortirait du dossier
  await unlink(path.join(AVATARS_DIR, path.basename(avatarUrl))).catch(() => {});
}
