import * as criminalService from '../services/criminals.service.js';

export const getAll = async (req, res) => {
  try {
    const criminals = await criminalService.getAllCriminals();
    return res.json(criminals);
  } catch (error) {
    console.error('Erreur lors de la récupération des dossiers:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const getById = async (req, res) => {
  try {
    const criminal = await criminalService.getCriminalById(req.params.id);
    return res.json(criminal);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ message: error.message });
    }
    console.error('Erreur lors de la récupération du dossier:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const create = async (req, res) => {
  try {
    const newCriminal = await criminalService.createCriminal(req.body, req.user?.id);
    return res.status(201).json({
      message: 'Dossier créé avec succès',
      criminal: newCriminal
    });
  } catch (error) {
    console.error('Erreur lors de la création du dossier:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const update = async (req, res) => {
  try {
    const updatedCriminal = await criminalService.updateCriminal(req.params.id, req.body);
    return res.json({
      message: 'Dossier mis à jour avec succès',
      criminal: updatedCriminal
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ message: error.message });
    }
    console.error('Erreur lors de la mise à jour du dossier:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const updateStatus = async (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ message: 'Le paramètre status est requis' });
  }

  try {
    const updatedCriminal = await criminalService.updateCriminalStatus(req.params.id, status);
    return res.json({
      message: 'Statut mis à jour avec succès',
      criminal: updatedCriminal
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ message: error.message });
    }
    console.error('Erreur lors du changement de statut:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};