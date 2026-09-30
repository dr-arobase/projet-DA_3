import * as criminalModel from '../models/criminal.model.js';
import * as auditLogModel from '../models/auditLog.model.js';
import { emitEvent } from '../sockets/index.js';

// Statuts valides autorisés (alignés sur le type criminal_status du schéma SQL)
const VALID_STATUSES = ['RECHERCHE', 'CAPTURE', 'EN_PRISON', 'LIBERE', 'ARCHIVE'];

// Route GET /api/criminals
export const getCriminals = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const status = req.query.status;
    const offset = (page - 1) * limit;

    const [criminals, total] = await Promise.all([
      criminalModel.findAll({ limit, offset, status }),
      criminalModel.countAll(status)
    ]);

    return res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: criminals
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des criminels:', error);
    return res.status(500).json({ message: 'Erreur serveur lors de la récupération' });
  }
};

// Route GET /api/criminals/:id
export const getCriminalById = async (req, res) => {
  const { id } = req.params;

  try {
    const criminal = await criminalModel.findById(id);
    if (!criminal) {
      return res.status(404).json({ message: 'Dossier criminel non trouvé' });
    }
    return res.json(criminal);
  } catch (error) {
    console.error('Erreur lors de la recherche du criminel:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Route POST /api/criminals
export const createCriminal = async (req, res) => {
  const { first_name, last_name, date_of_birth, nationality, description, crimes, status, photo_url } = req.body;

  if (!first_name || !last_name) {
    return res.status(400).json({ message: 'Le prénom et le nom sont obligatoires' });
  }
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ message: `Statut invalide. Les statuts autorisés sont: ${VALID_STATUSES.join(', ')}` });
  }

  try {
    const added_by = req.user.id;

    const created = await criminalModel.create({
      first_name, last_name, date_of_birth, nationality,
      description, crimes, status, photo_url, added_by
    });
    const newCriminal = await criminalModel.findById(created.id);
    
    emitEvent('criminal:added', newCriminal);
    
    return res.status(201).json({
      message: 'Dossier criminel créé avec succès',
      criminal: newCriminal
    });
  } catch (error) {
    console.error('Erreur lors de la création du criminel:', error);
    return res.status(500).json({ message: 'Erreur serveur lors de la création' });
  }
};

// Route PUT /api/criminals/:id
export const updateCriminal = async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, date_of_birth, nationality, description, crimes, photo_url } = req.body;

  try {
    const updated_by = req.user.id;
    const updated = await criminalModel.update(id, {
      first_name, last_name, date_of_birth, nationality, description, crimes, photo_url, updated_by
    });
    const updatedCriminal = updated ? await criminalModel.findById(id) : null;

    if (!updatedCriminal) {
      return res.status(404).json({ message: 'Dossier criminel non trouvé' });
    }

    return res.json({
      message: 'Dossier mis à jour avec succès',
      criminal: updatedCriminal
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du criminel:', error);
    return res.status(500).json({ message: 'Erreur serveur lors de la mise à jour' });
  }
};

// Route PATCH /api/criminals/:id/status
export const changeCriminalStatus = async (req, res) => {
  const { id } = req.params;
  const { status, version } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      message: `Statut invalide. Les statuts autorisés sont: ${VALID_STATUSES.join(', ')}`
    });
  }
  if (version === undefined) {
    return res.status(400).json({ message: 'Le champ version est obligatoire' });
  }

  try {
    const updated_by = req.user.id;
    const updatedRaw = await criminalModel.updateStatus(id, status, version, updated_by);
    const updatedCriminal = updatedRaw ? await criminalModel.findById(id) : null;
    
    if (!updatedCriminal) {
      const current = await criminalModel.findById(id);
      if (!current) {
        return res.status(404).json({ message: 'Dossier criminel non trouvé' });
      }
      return res.status(409).json({
        message: 'Conflit de version : ce dossier a été modifié entre-temps',
        criminal: current
      });
    }
    
    emitEvent('criminal:updated', updatedCriminal);
    
    return res.json({
      message: `Statut du dossier mis à jour à : ${status}`,
      criminal: updatedCriminal
    });
  } catch (error) {
    console.error('Erreur lors du changement de statut:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Route DELETE /api/criminals/:id
export const deleteCriminal = async (req, res) => {
  const { id } = req.params;

  try {
        const removed = await criminalModel.remove(id);
    if (!removed) {
      return res.status(404).json({ message: 'Dossier criminel non trouvé' });
    }

    await auditLogModel.record({
      actor_id: req.user.id,
      action: 'CRIMINAL_REMOVED',
      target_type: 'criminal',
      target_id: removed.id,
      details: { removed_by: req.user.badge_number }
    });
    
    emitEvent('criminal:removed', { id: removed.id });
    
    return res.json({ message: 'Dossier retiré avec succès', id: removed.id });
  } catch (error) {
    console.error('Erreur lors de la suppression du criminel:', error);
    return res.status(500).json({ message: 'Erreur serveur lors de la suppression' });
  }
};