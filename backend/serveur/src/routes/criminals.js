import express from 'express';
import {
  getCriminals,
  getCriminalById,
  createCriminal,
  updateCriminal,
  changeCriminalStatus,
  deleteCriminal
} from '../controllers/criminals.controller.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = express.Router();

// GET /api/criminals : liste paginée
router.get('/', getCriminals);

// GET /api/criminals/:id : détail d'un dossier
router.get('/:id', getCriminalById);

// POST /api/criminals : ajouter un dossier
router.post('/', createCriminal);

// PUT /api/criminals/:id : mettre à jour les informations d'un dossier
router.put('/:id', updateCriminal);

// PATCH /api/criminals/:id/status : changer le statut (avec version)
router.patch('/:id/status', changeCriminalStatus);

// DELETE /api/criminals/:id : retirer un dossier (superviseur ou direction)
router.delete('/:id', requireRole('superviseur'), deleteCriminal);

export default router;