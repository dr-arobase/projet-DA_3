import express from 'express';
import {
  createAlert, getAlerts, updateAlert, archiveAlert, restoreAlert,
} from '../controllers/alerts.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { validateId } from '../middleware/validateId.middleware.js';

const router = express.Router();

// Toutes ces routes exigent un agent connecté
router.use(verifyToken);
// /api/alerts/abc ou /api/alerts/0 : 400 avant d'atteindre la base
router.param('id', validateId);

// Tout agent peut diffuser une alerte (urgent); le service refuse un communiqué (info)
// à un policier (403) : la règle dépend du corps de la requête, pas seulement du rôle (#202).
router.post('/', createAlert);
router.get('/', getAlerts);

// Modifier, retirer (archiver) et remettre une diffusion : son auteur ou la direction (#220).
// La règle dépend de l'auteur de la diffusion : elle est vérifiée dans le service (403).
router.patch('/:id', updateAlert);
router.post('/:id/archive', archiveAlert);
router.post('/:id/restore', restoreAlert);

export default router;