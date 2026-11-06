import express from 'express';
import * as criminalController from '../controllers/criminals.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { validateId } from '../middleware/validateId.middleware.js';
import { readAvatar } from '../middleware/upload.middleware.js';

const router = express.Router();

// Applique verifyToken sur TOUTES les routes de dossiers
router.use(verifyToken);

// Endpoints accessibles à tout policier connecté
router.get('/', criminalController.getAll);
router.get('/:id', criminalController.getById);
router.post('/', criminalController.create);
router.patch('/:id/status', criminalController.updateStatus);
router.patch('/:id/address', criminalController.updateAddress);
// Photo du dossier : tout agent l'ajoute ou la change (image brute, 2 Mo); la retirer : superviseur
router.put('/:id/photo', readAvatar, criminalController.updatePhoto);
router.delete('/:id/photo', requireRole('superviseur'), criminalController.removePhoto);

// Modifier ou retirer un dossier : superviseur ou direction
router.put('/:id', requireRole('superviseur'), criminalController.update);
router.delete('/:id', requireRole('superviseur'), criminalController.remove);
// Tout identifiant de l'URL doit être un entier positif (sinon 400)
router.param('id', validateId);
export default router;
