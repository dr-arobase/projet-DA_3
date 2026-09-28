import express from 'express';
import * as criminalsController from '../controllers/criminals.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = express.Router();

// Tout le registre exige une session ; tous les rôles peuvent consulter et modifier.
router.use(authenticate);

router.get('/', criminalsController.list);
router.post('/', criminalsController.create);
router.get('/:id', criminalsController.getById);
router.patch('/:id', criminalsController.changeStatus);
router.delete('/:id', requireRole('superviseur', 'direction'), criminalsController.remove);

export default router;
