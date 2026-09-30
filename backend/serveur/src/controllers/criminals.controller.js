import * as criminalService from '../services/criminals.service.js';

// Les erreurs métier du service portent un statusCode (400, 404, 409) ;
// toute autre erreur est une panne serveur.
const handleError = (res, error, context) => {
  if (error.statusCode) {
    const body = { message: error.message };
    if (error.criminal) body.criminal = error.criminal;
    return res.status(error.statusCode).json(body);
  }
  console.error(`Erreur lors ${context}:`, error);
  return res.status(500).json({ message: 'Erreur serveur' });
};

export const getAll = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const result = await criminalService.getAllCriminals({ page, limit, status: req.query.status });
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'de la récupération des dossiers');
  }
};

export const getById = async (req, res) => {
  try {
    const criminal = await criminalService.getCriminalById(req.params.id);
    return res.json(criminal);
  } catch (error) {
    return handleError(res, error, 'de la récupération du dossier');
  }
};

export const create = async (req, res) => {
  try {
    const criminal = await criminalService.createCriminal(req.body, req.user.id);
    return res.status(201).json({ message: 'Dossier créé avec succès', criminal });
  } catch (error) {
    return handleError(res, error, 'de la création du dossier');
  }
};

export const update = async (req, res) => {
  try {
    const criminal = await criminalService.updateCriminal(req.params.id, req.body, req.user.id);
    return res.json({ message: 'Dossier mis à jour avec succès', criminal });
  } catch (error) {
    return handleError(res, error, 'de la mise à jour du dossier');
  }
};

export const updateStatus = async (req, res) => {
  const { status, version } = req.body;
  if (!status) {
    return res.status(400).json({ message: 'Le paramètre status est requis' });
  }

  try {
    const criminal = await criminalService.updateCriminalStatus(req.params.id, status, version, req.user.id);
    return res.json({ message: 'Statut mis à jour avec succès', criminal });
  } catch (error) {
    return handleError(res, error, 'du changement de statut');
  }
};

export const remove = async (req, res) => {
  try {
    const removed = await criminalService.deleteCriminal(req.params.id, req.user);
    return res.json({ message: 'Dossier retiré avec succès', id: removed.id });
  } catch (error) {
    return handleError(res, error, 'du retrait du dossier');
  }
};
