import * as sightingModel from '../models/sighting.model.js';
import * as criminalModel from '../models/criminal.model.js';

// POST /api/sightings : signaler une observation
export const createSighting = async (req, res) => {
  const { criminal_id, location, notes } = req.body;

  if (!criminal_id || !location) {
    return res.status(400).json({ message: 'criminal_id et location sont obligatoires' });
  }

  try {
    const criminal = await criminalModel.findById(criminal_id);
    if (!criminal) {
      return res.status(404).json({ message: 'Dossier criminel non trouvé' });
    }

    const reported_by = req.user.id;
    const created = await sightingModel.create({ criminal_id, reported_by, location, notes });
    const sighting = await sightingModel.findById(created.id);

    return res.status(201).json({ message: 'Observation signalée avec succès', sighting });
  } catch (error) {
    console.error('Erreur lors du signalement:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// GET /api/sightings?criminal_id=... : historique des signalements pour un dossier
export const getSightingsByCriminal = async (req, res) => {
  const { criminal_id } = req.query;

  if (!criminal_id) {
    return res.status(400).json({ message: 'Le paramètre criminal_id est obligatoire' });
  }

  try {
    const sightings = await sightingModel.findByCriminal(criminal_id);
    return res.json(sightings);
  } catch (error) {
    console.error('Erreur lors de la récupération des signalements:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};