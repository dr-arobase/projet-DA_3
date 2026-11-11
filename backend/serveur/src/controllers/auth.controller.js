import * as authService from '../services/auth.service.js';
import * as githubService from '../services/github.service.js';
import {
  COOKIE_NAME, CSRF_COOKIE_NAME, cookieOptions, csrfCookieOptions, readCookie,
} from '../utils/session.js';
import { createCsrfToken } from '../utils/csrf.js';
import * as auditLogModel from '../models/auditLog.model.js';
import * as deuxFacteurs from '../services/deuxFacteurs.service.js';
import { signToken, signDeuxiemeEtape, verifyDeuxiemeEtape } from '../utils/jwt.js';
import * as userModel from '../models/user.model.js';

// Deuxième étape de connexion (double authentification) : un cookie httpOnly de 5 minutes, limité aux
// routes /api/auth, prouve que le mot de passe (ou GitHub) est vérifié. La session n'est posée qu'après le code.
const COOKIE_DEUXIEME_ETAPE = 'crimetracker_deuxieme_etape';
const CINQ_MINUTES = 5 * 60 * 1000;
const optionsDeuxiemeEtape = () => ({ ...cookieOptions(), path: '/api/auth' });

const poserDeuxiemeEtape = (res, id, seSouvenir) => res.cookie(
  COOKIE_DEUXIEME_ETAPE, signDeuxiemeEtape({ id, seSouvenir }), { ...optionsDeuxiemeEtape(), maxAge: CINQ_MINUTES }
);

const poserSession = (res, token, seSouvenir) => {
  res.cookie(COOKIE_NAME, token, cookieOptions(seSouvenir));
  res.cookie(CSRF_COOKIE_NAME, createCsrfToken(), csrfCookieOptions(seSouvenir));
};

const DEUXIEME_ETAPE_REQUISE = {
  deuxFacteurs: true,
  message: 'Entrez le code à 6 chiffres de votre application d\'authentification.',
};

const minutesRestantes = (jusqua) => Math.max(1, Math.ceil((new Date(jusqua) - Date.now()) / 60000));

// Réponse commune aux erreurs de code
function erreurCode(res, error) {
  if (error.message === 'CODE_INVALIDE') {
    return res.status(401).json({ message: 'Code incorrect ou déjà utilisé.' });
  }
  if (error.message === 'TOTP_BLOQUE') {
    return res.status(429).json({
      message: `Trop de codes incorrects. Réessayez dans ${minutesRestantes(error.jusqua)} minute(s).`,
    });
  }
  return null;
}

export const login = async (req, res) => {
  const { badge_number, password, se_souvenir } = req.body || {};

  // Validation basique des entrées
  if (!badge_number || !password) {
    return res.status(400).json({ message: 'Le matricule et le mot de passe sont requis' });
  }

  try {
    const data = await authService.loginUser(badge_number, password);
    const seSouvenir = se_souvenir === true || se_souvenir === 'true';
    // Double authentification active : pas encore de session, on demande le code
    if (data.user.totp_active) {
      poserDeuxiemeEtape(res, data.user.id, seSouvenir);
      return res.json(DEUXIEME_ETAPE_REQUISE);
    }
    // Le navigateur garde le jeton dans un cookie httpOnly ; il reste aussi dans
    // la réponse pour les clients sans cookie (Swagger, scripts, Socket.IO en Node).
    poserSession(res, data.token, seSouvenir);
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
    // Double authentification active : la page de connexion demande le code
    if (data.user.totp_active) {
      poserDeuxiemeEtape(res, data.user.id, false);
      return versConnexion(res, 'etape=code');
    }
    poserSession(res, data.token, false);
    return versConnexion(res, 'github=ok');
  } catch (err) {
    if (err.message === 'INVALID_CREDENTIALS') {
      return versConnexion(res, 'erreur=inactif');
    }
    console.error('Erreur lors de la connexion GitHub:', err);
    return versConnexion(res, 'erreur=github');
  }
};

// POST /api/auth/login/code : deuxième étape, le code à 6 chiffres ou un code de secours
export const loginCode = async (req, res) => {
  const jeton = readCookie(req.headers.cookie, COOKIE_DEUXIEME_ETAPE);
  let etape;
  try {
    etape = verifyDeuxiemeEtape(jeton);
  } catch {
    return res.status(401).json({ message: 'Étape de connexion expirée. Reconnectez-vous.' });
  }
  const { code } = req.body || {};
  if (typeof code !== 'string' || !code.trim() || code.length > 20) {
    return res.status(400).json({ message: 'Le code est requis.' });
  }

  try {
    await deuxFacteurs.verifier(etape.id, code);
    const user = await userModel.findById(etape.id);
    if (!user || !user.is_active) throw new Error('INVALID_CREDENTIALS');
    const token = signToken({ id: user.id, badge_number: user.badge_number, role: user.role, grade: user.grade });
    res.clearCookie(COOKIE_DEUXIEME_ETAPE, optionsDeuxiemeEtape());
    poserSession(res, token, etape.seSouvenir === true);
    return res.json({ message: 'Connexion réussie', user: await authService.getCurrentUser(user.id) });
  } catch (error) {
    const reponse = erreurCode(res, error);
    if (reponse) return reponse;
    if (error.message === 'INVALID_CREDENTIALS' || error.message === 'TOTP_INACTIVE') {
      res.clearCookie(COOKIE_DEUXIEME_ETAPE, optionsDeuxiemeEtape());
      return res.status(401).json({ message: 'Identifiants invalides ou compte inactif' });
    }
    console.error('Erreur lors de la vérification du code :', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// POST /api/auth/2fa/preparer : nouveau secret, montré une seule fois (code QR et clé manuelle)
export const preparerDeuxFacteurs = async (req, res) => {
  try {
    return res.json(await deuxFacteurs.preparer(req.user.id));
  } catch (error) {
    if (error.message === 'TOTP_DEJA_ACTIVE') {
      return res.status(409).json({ message: 'La double authentification est déjà active.' });
    }
    if (error.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ message: 'Session expirée ou compte inactif' });
    }
    console.error('Erreur lors de la préparation de la double authentification :', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// POST /api/auth/2fa/activer : premier code; renvoie les 10 codes de secours, une seule fois
export const activerDeuxFacteurs = async (req, res) => {
  const { code } = req.body || {};
  if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
    return res.status(400).json({ message: 'Entrez le code à 6 chiffres affiché par l\'application.' });
  }
  try {
    const { codesSecours } = await deuxFacteurs.activer(req.user.id, code);
    return res.json({
      message: 'Double authentification activée.',
      codesSecours,
      user: await authService.getCurrentUser(req.user.id),
    });
  } catch (error) {
    if (error.message === 'CODE_INVALIDE') {
      return res.status(400).json({ message: 'Code incorrect. Vérifiez que le code QR a bien été scanné, puis réessayez.' });
    }
    if (error.message === 'TOTP_NON_PREPARE') {
      return res.status(400).json({ message: 'Commencez par afficher le code QR.' });
    }
    if (error.message === 'TOTP_DEJA_ACTIVE') {
      return res.status(409).json({ message: 'La double authentification est déjà active.' });
    }
    if (error.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ message: 'Session expirée ou compte inactif' });
    }
    console.error('Erreur lors de l\'activation de la double authentification :', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// POST /api/auth/2fa/desactiver : mot de passe (si le compte en a un) et un code valide
export const desactiverDeuxFacteurs = async (req, res) => {
  const { mot_de_passe, code } = req.body || {};
  if (typeof code !== 'string' || !code.trim() || code.length > 20) {
    return res.status(400).json({ message: 'Le code est requis.' });
  }
  try {
    await deuxFacteurs.desactiver(req.user.id, { motDePasse: mot_de_passe, code });
    return res.json({ message: 'Double authentification désactivée.', user: await authService.getCurrentUser(req.user.id) });
  } catch (error) {
    const reponse = erreurCode(res, error);
    if (reponse) return reponse;
    if (error.message === 'WRONG_PASSWORD') {
      return res.status(400).json({ message: 'Mot de passe actuel incorrect' });
    }
    if (error.message === 'TOTP_INACTIVE') {
      return res.status(409).json({ message: 'La double authentification n\'est pas active.' });
    }
    if (error.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ message: 'Session expirée ou compte inactif' });
    }
    console.error('Erreur lors de la désactivation de la double authentification :', error);
    return res.status(500).json({ message: 'Erreur serveur' });
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
