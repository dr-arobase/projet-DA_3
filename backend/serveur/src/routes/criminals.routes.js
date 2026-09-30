import express from 'express';
import * as criminalController from '../controllers/criminals.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Applique verifyToken sur TOUTES les routes de dossiers
router.use(verifyToken);

// Endpoints accessibles à tout policier connecté
router.get('/', criminalController.getAll);
router.get('/:id', criminalController.getById);
router.post('/', criminalController.create);
router.put('/:id', criminalController.update);
router.patch('/:id/status', criminalController.updateStatus);

export default router;