const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Statuts valides autorisés
const VALID_STATUSES = ['WANTED', 'CAPTURED', 'IN_PRISON', 'RELEASED', 'ARCHIVED'];

// Route GET /api/dossier/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params; 
  try {
    const result = await db.query('SELECT * FROM criminal WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Dossier non trouvé' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erreur lors de la récupération du dossier:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route POST /api/dossier
router.post('/', async (req, res) => {
  const { first_name, last_name, description, status, added_by } = req.body;

  try {
    const query = `
      INSERT INTO criminal (first_name, last_name, description, status, added_by) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING id, added_at
    `;
    const values = [first_name, last_name, description, status || 'WANTED', added_by];
    
    const result = await db.query(query, values);
    const createdRecord = result.rows[0];

    res.status(201).json({ 
      message: 'Dossier créé avec succès', 
      id: createdRecord.id,
      added_at: createdRecord.added_at
    });
  } catch (error) {
    console.error('Erreur lors de la création du dossier:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  } 
});

// Route PUT /api/dossier/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, description, status } = req.body;

  try {
    const query = `
      UPDATE criminal 
      SET first_name = $1, last_name = $2, description = $3, status = $4, updated_at = NOW() 
      WHERE id = $5
    `;
    const result = await db.query(query, [first_name, last_name, description, status, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Dossier non trouvé' });
    }

    res.json({ message: 'Dossier mis à jour avec succès' });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du dossier:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route PATCH /api/dossier/:id/status (Remplace la suppression)
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ 
      message: `Statut invalide. Les statuts autorisés sont: ${VALID_STATUSES.join(', ')}` 
    });
  }

  try {
    const query = `
      UPDATE criminal 
      SET status = $1, updated_at = NOW() 
      WHERE id = $2 
      RETURNING *
    `;
    const result = await db.query(query, [status, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Dossier non trouvé' });
    }

    res.json({ message: `Statut mis à jour à : ${status}`, criminal: result.rows[0] });
  } catch (error) {
    console.error('Erreur lors du changement de statut:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;