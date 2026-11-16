import * as alertService from '../services/alerts.service.js';
import { readPagination } from '../utils/pagination.js';

// Le contrôleur lit la requête et répond ; la logique est dans alerts.service.js.
// Les erreurs prévues du service portent un statusCode (400, 403, 404, 409) ;
// toute autre erreur est une panne serveur.
const handleError = (res, error, context) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  console.error(`Erreur lors ${context}:`, error);
  return res.status(500).json({ message: 'Erreur serveur' });
};

// POST /api/alerts : diffuser une alerte (tout agent) ou un communiqué (superviseur, direction)
export const createAlert = async (req, res) => {
  try {
    const alert = await alertService.createAlert(req.body, req.user);
    return res.status(201).json({ message: 'Alerte diffusée avec succès', alert });
  } catch (error) {
    return handleError(res, error, 'de la diffusion de l\'alerte');
  }
};

// GET /api/alerts
export const getAlerts = async (req, res) => {
  try {
    const { page, limit, offset } = readPagination(req.query, 20);
    // 400 si un filtre est mal formé (#84)
    const { severity, since, archived } = alertService.readFilters(req.query);

    const alerts = await alertService.listAlerts({ limit, offset, severity, since, archived });
    if (!severity && !since && !archived) return res.json({ page, limit, data: alerts });
    const total = await alertService.countAlerts({ severity, since, archived });
    return res.json({ page, limit, total, totalPages: Math.ceil(total / limit), data: alerts });
  } catch (error) {
    return handleError(res, error, 'de la récupération des alertes');
  }
};

// PATCH /api/alerts/:id : modifier le texte (auteur ou direction, #220)
export const updateAlert = async (req, res) => {
  try {
    const alert = await alertService.updateAlert(Number(req.params.id), req.body, req.user);
    return res.json({ message: 'Diffusion modifiée', alert });
  } catch (error) {
    return handleError(res, error, 'de la modification de la diffusion');
  }
};

// POST /api/alerts/:id/archive : retirer (archiver, pas supprimer)
export const archiveAlert = async (req, res) => {
  try {
    const alert = await alertService.archiveAlert(Number(req.params.id), req.user);
    return res.json({ message: 'Diffusion retirée : elle est dans les Archives', alert });
  } catch (error) {
    return handleError(res, error, 'du retrait de la diffusion');
  }
};

// POST /api/alerts/:id/restore : remettre une diffusion retirée
export const restoreAlert = async (req, res) => {
  try {
    const alert = await alertService.restoreAlert(Number(req.params.id), req.user);
    return res.json({ message: 'Diffusion remise', alert });
  } catch (error) {
    return handleError(res, error, 'de la remise de la diffusion');
  }
};
