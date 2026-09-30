import express from 'express';
import * as authController from '../controllers/auth.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Route publique : Connexion
router.post('/login', authController.login);

// Route protégée : Déconnexion
router.post('/logout', verifyToken, authController.logout);

// Route protégée : profil de l'agent connecté (le frontend vérifie ainsi sa session)
router.get('/me', verifyToken, authController.me);

export default router;