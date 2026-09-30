import express from 'express';
import { createAlert, getAlerts } from '../controllers/alerts.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = express.Router();

// Toutes ces routes exigent un agent connecté
router.use(verifyToken);

router.post('/', requireRole('superviseur'), createAlert);
router.get('/', getAlerts);

export default router;