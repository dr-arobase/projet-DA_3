import express from 'express';
import * as authController from '../controllers/auth.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { limitLoginAttempts } from '../middleware/login-rate-limit.middleware.js';
import { readAvatar } from '../middleware/upload.middleware.js';

const router = express.Router();

// Route publique : Connexion
router.post('/login', limitLoginAttempts, authController.login);

// Route publique : deuxième étape de la connexion (double authentification). Elle exige le cookie
// de deuxième étape posé par /login ou par le retour de GitHub, et compte les essais comme /login.
router.post('/login/code', limitLoginAttempts, authController.loginCode);

// Routes protégées : double authentification de l'agent connecté (facultative, tous les comptes)
router.post('/2fa/preparer', verifyToken, authController.preparerDeuxFacteurs);
router.post('/2fa/activer', verifyToken, authController.activerDeuxFacteurs);
router.post('/2fa/desactiver', verifyToken, authController.desactiverDeuxFacteurs);

// Routes publiques : connexion GitHub (OAuth 2). Le navigateur y est envoyé, il ne les appelle pas en fetch
router.get('/github', authController.githubStart);
router.get('/github/callback', authController.githubCallback);

// Route protégée : Déconnexion
router.post('/logout', verifyToken, authController.logout);

// Route protégée : profil de l'agent connecté (le frontend vérifie ainsi sa session)
router.get('/me', verifyToken, authController.me);

// Route protégée : l'agent connecté change son propre mot de passe
router.post('/change-password', verifyToken, authController.changePassword);

// Routes protégées : photo de profil de l'agent connecté (image brute dans le corps, 2 Mo max)
router.put('/avatar', verifyToken, readAvatar, authController.uploadAvatar);
router.delete('/avatar', verifyToken, authController.deleteAvatar);

export default router;