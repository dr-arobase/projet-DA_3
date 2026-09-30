import express from 'express';
import { createSighting, getSightingsByCriminal } from '../controllers/sightings.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = express.Router();

// Toutes ces routes exigent un agent connecté
router.use(verifyToken);

router.post('/', createSighting);
router.get('/', requireRole('superviseur'), getSightingsByCriminal);

export default router;