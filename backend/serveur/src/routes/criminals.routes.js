import express from 'express';
import * as criminalController from '../controllers/criminals.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { validateId } from '../middleware/validateId.middleware.js';

const router = express.Router();

// Applique verifyToken sur TOUTES les routes de dossiers
router.use(verifyToken);

// Endpoints accessibles à tout policier connecté
router.get('/', criminalController.getAll);
router.get('/:id', criminalController.getById);
router.post('/', criminalController.create);
router.patch('/:id/status', criminalController.updateStatus);
router.patch('/:id/address', criminalController.updateAddress);

// Modifier ou retirer un dossier : superviseur ou direction
router.put('/:id', requireRole('superviseur'), criminalController.update);
router.delete('/:id', requireRole('superviseur'), criminalController.remove);
// Tout identifiant de l'URL doit être un entier positif (sinon 400)
router.param('id', validateId);
export default router;
