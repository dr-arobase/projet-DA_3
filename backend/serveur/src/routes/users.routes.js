import express from 'express';
import {
  getUsers, getUserById, createUser, deactivateUser, reactivateUser, promoteUser
} from '../controllers/users.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = express.Router();

// Toutes ces routes exigent un agent connecté
router.use(verifyToken);

router.get('/', requireRole('superviseur'), getUsers);
router.get('/:id', requireRole('superviseur'), getUserById);
router.post('/', requireRole('superviseur'), createUser);
router.patch('/:id/deactivate', requireRole('superviseur'), deactivateUser);
router.patch('/:id/reactivate', requireRole('superviseur'), reactivateUser);
router.patch('/:id/promote', requireRole('direction'), promoteUser);

export default router;