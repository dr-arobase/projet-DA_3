import * as authService from '../services/auth.service.js';
import { COOKIE_NAME, cookieOptions } from '../utils/session.js';

export const login = async (req, res) => {
  const { badge_number, password, se_souvenir } = req.body;

  // Validation basique des entrées
  if (!badge_number || !password) {
    return res.status(400).json({ message: 'Le matricule et le mot de passe sont requis' });
  }

  try {
    const data = await authService.loginUser(badge_number, password);
    // Le navigateur garde le jeton dans un cookie httpOnly ; il reste aussi dans
    // la réponse pour les clients sans cookie (Swagger, scripts, Socket.IO en Node).
    const seSouvenir = se_souvenir === true || se_souvenir === 'true';
    res.cookie(COOKIE_NAME, data.token, cookieOptions(seSouvenir));
    return res.json(data);
  } catch (error) {
    // Gestion des erreurs métiers renvoyées par le service
    if (error.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ message: 'Identifiants invalides ou compte inactif' });
    }

    console.error('Erreur lors du login:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const logout = async (req, res) => {
  try {
    // req.user est disponible grâce au middleware verifyToken
    const result = await authService.logoutUser(req.user.id);
    const { maxAge, ...options } = cookieOptions();
    res.clearCookie(COOKIE_NAME, options);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Erreur lors du logout:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};



export const me = async (req, res) => {
  try {
    const user = await authService.getCurrentUser(req.user.id);
    return res.json({ user });
  } catch (error) {
    if (error.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ message: 'Session expirée ou compte inactif' });
    }
    console.error('Erreur lors de la lecture du profil:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const MIN_PASSWORD_LENGTH = 8;

export const changePassword = async (req, res) => {
  const { old_password, new_password } = req.body;

  if (!old_password || !new_password) {
    return res.status(400).json({ message: "L'ancien et le nouveau mot de passe sont requis" });
  }
  if (new_password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ message: `Le nouveau mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères` });
  }
  if (old_password === new_password) {
    return res.status(400).json({ message: "Le nouveau mot de passe doit être différent de l'ancien" });
  }

  try {
    const result = await authService.changePassword(req.user.id, old_password, new_password);
    return res.json(result);
  } catch (error) {
    if (error.message === 'WRONG_PASSWORD') {
      return res.status(400).json({ message: 'Mot de passe actuel incorrect' });
    }
    if (error.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ message: 'Session expirée ou compte inactif' });
    }
    console.error('Erreur lors du changement de mot de passe:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const uploadAvatar = async (req, res) => {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(415).json({ message: 'Envoyez une image JPG, PNG ou WebP' });
  }

  try {
    const user = await authService.setAvatar(req.user.id, req.get('Content-Type'), req.body);
    return res.json({ message: 'Photo de profil mise à jour', user });
  } catch (error) {
    if (error.message === 'INVALID_IMAGE') {
      return res.status(415).json({ message: "Le fichier n'est pas une image JPG, PNG ou WebP valide" });
    }
    if (error.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ message: 'Session expirée ou compte inactif' });
    }
    console.error("Erreur lors de l'envoi de la photo de profil:", error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const deleteAvatar = async (req, res) => {
  try {
    const user = await authService.removeAvatar(req.user.id);
    return res.json({ message: 'Photo de profil supprimée', user });
  } catch (error) {
    if (error.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ message: 'Session expirée ou compte inactif' });
    }
    console.error('Erreur lors de la suppression de la photo de profil:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};
