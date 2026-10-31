import * as sightingModel from '../models/sighting.model.js';
import * as criminalModel from '../models/criminal.model.js';
import { emitEvent } from '../sockets/index.js';
import { texte, estVisible } from '../utils/texte.js';

const MAX_LOCATION = 255; // sighting.location VARCHAR(255)
const MAX_NOTES = 2000;

const MAX_RECENT = 500;

// Position facultative : les deux coordonnées ensemble, dans les bornes, sinon null
function lirePosition(latitude, longitude) {
  const absente = (v) => v === undefined || v === null || v === '';
  if (absente(latitude) && absente(longitude)) return { latitude: null, longitude: null };
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (absente(latitude) || absente(longitude) || !Number.isFinite(lat) || !Number.isFinite(lng)
    || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { latitude: lat, longitude: lng };
}

// POST /api/sightings : signaler une observation
export const createSighting = async (req, res) => {
  const { criminal_id, latitude, longitude } = req.body;
  // Le lieu et les notes doivent être du texte (#94) : un objet ou un tableau était enregistré tel quel
  const location = texte(req.body.location);
  if (!criminal_id || !location || !estVisible(location)) {
    return res.status(400).json({ message: 'criminal_id et location sont obligatoires' });
  }
  if (location.length > MAX_LOCATION) {
    return res.status(400).json({ message: `Le lieu dépasse ${MAX_LOCATION} caractères` });
  }
  if (req.body.notes !== undefined && req.body.notes !== null && typeof req.body.notes !== 'string') {
    return res.status(400).json({ message: 'Les notes doivent être un texte' });
  }
  const notes = texte(req.body.notes) || null;
  if (notes && notes.length > MAX_NOTES) {
    return res.status(400).json({ message: `Les notes dépassent ${MAX_NOTES} caractères` });
  }
  const position = lirePosition(latitude, longitude);
  if (!position) {
    return res.status(400).json({ message: 'latitude (-90 à 90) et longitude (-180 à 180) vont ensemble' });
  }

  try {
    const criminal = await criminalModel.findById(criminal_id);
    if (!criminal) {
      return res.status(404).json({ message: 'Dossier criminel non trouvé' });
    }

    const reported_by = req.user.id;
    const created = await sightingModel.create({ criminal_id, reported_by, location, notes, ...position });
    const sighting = await sightingModel.findById(created.id);

    emitEvent('sighting:added', sighting);
    return res.status(201).json({ message: 'Observation signalée avec succès', sighting });
  } catch (error) {
    console.error('Erreur lors du signalement:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// GET /api/sightings/recent?limit=... : derniers signalements, tous dossiers confondus (carte)
export const getRecentSightings = async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), MAX_RECENT);
  try {
    const sightings = await sightingModel.findRecent({ limit });
    return res.json(sightings);
  } catch (error) {
    console.error('Erreur lors de la récupération des signalements récents:', error);
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
