const criminalModel = require('../models/criminal.model');

// Statuts valides autorisés
const VALID_STATUSES = ['WANTED', 'CAPTURED', 'IN_PRISON', 'RELEASED', 'ARCHIVED'];

// Route GET /api/criminals
const getCriminals = async (req, res) => {
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
const getCriminalById = async (req, res) => {
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
const createCriminal = async (req, res) => {
  const { first_name, last_name, description, status, photo_url } = req.body;

  if (!first_name || !last_name) {
    return res.status(400).json({ message: 'Le prénom et le nom sont obligatoires' });
  }

  try {
    const added_by = req.user ? req.user.id : req.body.added_by;

    const newCriminal = await criminalModel.create({
      first_name,
      last_name,
      description,
      status: status || 'WANTED',
      photo_url,
      added_by
    });

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
const updateCriminal = async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, description, status, photo_url } = req.body;

  try {
    const updatedCriminal = await criminalModel.update(id, {
      first_name,
      last_name,
      description,
      status,
      photo_url
    });

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
const changeCriminalStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ 
      message: `Statut invalide. Les statuts autorisés sont: ${VALID_STATUSES.join(', ')}` 
    });
  }

  try {
    const updatedCriminal = await criminalModel.updateStatus(id, status);

    if (!updatedCriminal) {
      return res.status(404).json({ message: 'Dossier criminel non trouvé' });
    }

    return res.json({
      message: `Statut du dossier mis à jour à : ${status}`,
      criminal: updatedCriminal
    });
  } catch (error) {
    console.error('Erreur lors du changement de statut:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

module.exports = {
  getCriminals,
  getCriminalById,
  createCriminal,
  updateCriminal,
  changeCriminalStatus
};