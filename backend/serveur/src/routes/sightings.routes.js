import express from 'express';
import { createSighting, getRecentSightings, getSightingsByCriminal } from '../controllers/sightings.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = express.Router();

// Toutes ces routes exigent un agent connecté
router.use(verifyToken);

router.post('/', createSighting);
// Carte : derniers signalements, pour tout agent connecté
router.get('/recent', getRecentSightings);
router.get('/', requireRole('superviseur'), getSightingsByCriminal);

export default router;
