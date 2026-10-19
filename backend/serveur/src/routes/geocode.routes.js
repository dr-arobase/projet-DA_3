import express from 'express';
import { verifyToken } from '../middleware/auth.middleware.js';
import { geocode } from '../services/geocoding.service.js';

const router = express.Router();

const MIN_LONGUEUR = 3;
const MAX_LONGUEUR = 255;

// GET /api/geocode?q=<adresse> : position d'une adresse (formulaire de signalement, #65).
// Réservé aux agents connectés, pour que l'API ne serve pas de relais ouvert vers Nominatim.
router.get('/', verifyToken, async (req, res) => {
  const adresse = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (adresse.length < MIN_LONGUEUR || adresse.length > MAX_LONGUEUR) {
    return res.status(400).json({ message: `L'adresse doit contenir de ${MIN_LONGUEUR} à ${MAX_LONGUEUR} caractères` });
  }

  try {
    const position = await geocode(adresse);
    if (!position) return res.status(404).json({ message: 'Adresse introuvable. Précisez la ville ou le code postal.' });
    return res.json(position);
  } catch (error) {
    console.error('Erreur de géocodage:', error.cause ?? error);
    return res.status(503).json({ message: 'Le service de localisation ne répond pas. Réessayez, ou cliquez sur la carte.' });
  }
});

export default router;
