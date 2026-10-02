import express from 'express';
import * as authController from '../controllers/auth.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { readAvatar } from '../middleware/upload.middleware.js';

const router = express.Router();

// Route publique : Connexion
router.post('/login', authController.login);

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