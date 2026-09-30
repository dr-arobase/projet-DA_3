import express from 'express';
import { createSighting, getSightingsByCriminal } from '../controllers/sightings.controller.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = express.Router();

router.post('/', createSighting);
router.get('/', requireRole('superviseur'), getSightingsByCriminal);

export default router;