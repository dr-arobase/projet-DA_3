import express from 'express';
import { getAuditLogs } from '../controllers/auditLogs.controller.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = express.Router();

router.get('/', requireRole('direction'), getAuditLogs);

export default router;