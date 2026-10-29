import * as alertService from '../services/alerts.service.js';
import { readPagination } from '../utils/pagination.js';

// Le contrôleur lit la requête et répond ; la logique est dans alerts.service.js.
// Les erreurs prévues du service portent un statusCode (400, 404) ;
// toute autre erreur est une panne serveur.
const handleError = (res, error, context) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  console.error(`Erreur lors ${context}:`, error);
  return res.status(500).json({ message: 'Erreur serveur' });
};

// POST /api/alerts : diffuser une alerte
export const createAlert = async (req, res) => {
  try {
    const alert = await alertService.createAlert(req.body, req.user.id);
    return res.status(201).json({ message: 'Alerte diffusée avec succès', alert });
  } catch (error) {
    return handleError(res, error, 'de la diffusion de l\'alerte');
  }
};

// GET /api/alerts
export const getAlerts = async (req, res) => {
  try {
    const { page, limit, offset } = readPagination(req.query, 20);
    const severity = req.query.severity || undefined;
    const since = req.query.since || undefined;

    const alerts = await alertService.listAlerts({ limit, offset, severity, since });
    if (!severity && !since) return res.json({ page, limit, data: alerts });
    const total = await alertService.countAlerts({ severity, since });
    return res.json({ page, limit, total, totalPages: Math.ceil(total / limit), data: alerts });
  } catch (error) {
    return handleError(res, error, 'de la récupération des alertes');
  }
};