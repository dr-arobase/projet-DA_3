import * as authService from '../services/auth.service.js';
import * as githubService from '../services/github.service.js';
import {
  COOKIE_NAME, CSRF_COOKIE_NAME, cookieOptions, csrfCookieOptions, readCookie,
} from '../utils/session.js';
import { createCsrfToken } from '../utils/csrf.js';
import * as auditLogModel from '../models/auditLog.model.js';

export const login = async (req, res) => {
  const { badge_number, password, se_souvenir } = req.body || {};

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
    res.cookie(CSRF_COOKIE_NAME, createCsrfToken(), csrfCookieOptions(seSouvenir));
    return res.json(data);
  } catch (error) {
    // Gestion des erreurs métiers renvoyées par le service
    if (error.message === 'INVALID_CREDENTIALS') {
      // Journal d'audit (#100), pour toutes les connexions ratées, matricule connu ou non :
      // le même travail dans les deux cas ne révèle pas si le matricule existe (#90).
      // Sans attendre : une panne du journal ne doit pas changer la réponse.
      auditLogModel.record({
        actor_id: null,
        action: 'LOGIN_FAILED',
        target_type: 'user',
        target_id: null,
        details: { badge_number: String(badge_number).slice(0, 50), ip: req.ip },
      }).catch((err) => console.error('Journal d\'audit (connexion ratée) :', err.message));
      return res.status(401).json({ message: 'Identifiants invalides ou compte inactif' });
    }

    console.error('Erreur lors du login:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Connexion GitHub. Le state aléatoire voyage dans l'adresse GitHub ET dans un cookie
// httpOnly; au retour, les deux doivent être identiques (protection CSRF du flux OAuth).
// Le cookie est limité aux routes /api/auth/github et dure 10 minutes.
const STATE_COOKIE = 'crimetracker_oauth_state';
const stateCookieOptions = () => ({
  ...cookieOptions(),
  path: '/api/auth/github',
});
const DIX_MINUTES = 10 * 60 * 1000;

// Redirige vers la page de connexion du frontend (même origine) avec le résultat
const versConnexion = (res, resultat) => res.redirect(`/connexion?${resultat}`);

export const githubStart = (req, res) => {
  if (!githubService.isConfigured()) {
    return versConnexion(res, 'erreur=github-non-configure');
  }
  const { state, url } = githubService.authorizationUrl();
  res.cookie(STATE_COOKIE, state, { ...stateCookieOptions(), maxAge: DIX_MINUTES });
  return res.redirect(url);
};

export const githubCallback = async (req, res) => {
  const { code, state, error } = req.query;
  const stateAttendu = readCookie(req.headers.cookie, STATE_COOKIE);
  res.clearCookie(STATE_COOKIE, stateCookieOptions());

  // L'agent a refusé l'autorisation sur GitHub
  if (error) {
    return versConnexion(res, 'erreur=github-annule');
  }
  if (typeof code !== 'string' || typeof state !== 'string' || !stateAttendu || state !== stateAttendu) {
    return versConnexion(res, 'erreur=github');
  }

  try {
    const profile = await githubService.fetchProfile(code);
    const data = await authService.loginWithGithub(profile);
    res.cookie(COOKIE_NAME, data.token, cookieOptions());
    res.cookie(CSRF_COOKIE_NAME, createCsrfToken(), csrfCookieOptions());
    return versConnexion(res, 'github=ok');
  } catch (err) {
    if (err.message === 'INVALID_CREDENTIALS') {
      return versConnexion(res, 'erreur=inactif');
    }
    console.error('Erreur lors de la connexion GitHub:', err);
    return versConnexion(res, 'erreur=github');
  }
};

export const logout = async (req, res) => {
  try {
    // req.user est disponible grâce au middleware verifyToken
    const result = await authService.logoutUser();
    const options = cookieOptions();
    delete options.maxAge;
    res.clearCookie(COOKIE_NAME, options);
    res.clearCookie(CSRF_COOKIE_NAME, csrfCookieOptions());
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
    if (error.message === 'NO_PASSWORD') {
      return res.status(400).json({ message: "Ce compte se connecte avec GitHub : il n'a pas de mot de passe" });
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
