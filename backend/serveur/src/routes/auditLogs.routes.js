import express from 'express';
import { getAuditLogs } from '../controllers/auditLogs.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = express.Router();

// Toutes ces routes exigent un agent connecté
router.use(verifyToken);

router.get('/', requireRole('direction'), getAuditLogs);

export default router;