import express from 'express';
import * as authController from '../controllers/auth.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Route publique : Connexion
router.post('/login', authController.login);

// Route protégée : Déconnexion
router.post('/logout', verifyToken, authController.logout);

export default router;