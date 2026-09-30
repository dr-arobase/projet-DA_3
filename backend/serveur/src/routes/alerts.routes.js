import express from 'express';
import { createAlert, getAlerts } from '../controllers/alerts.controller.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = express.Router();

router.post('/', requireRole('superviseur'), createAlert);
router.get('/', getAlerts);

export default router;