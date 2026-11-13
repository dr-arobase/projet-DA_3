import express from 'express';
import { createAlert, getAlerts } from '../controllers/alerts.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Toutes ces routes exigent un agent connecté
router.use(verifyToken);

// Tout agent peut diffuser une alerte (urgent); le service refuse un communiqué (info)
// à un policier (403) : la règle dépend du corps de la requête, pas seulement du rôle (#202).
router.post('/', createAlert);
router.get('/', getAlerts);

export default router;