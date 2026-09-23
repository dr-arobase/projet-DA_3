const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /api/dossier/:id : Récupérer un dossier par ID
router.get('/:id', async (req, res) => {
  const { id } = req.params; 
  const dossier = await db.query('SELECT * FROM dossiers WHERE id = ?', [id]);
  if (dossier.length === 0) {
    return res.status(404).json({ message: 'Dossier non trouvé' });
  }
  res.json(dossier[0]);
});

// POST /api/dossier : Créer un nouveau dossier
router.post('/', async (req, res) => {
  const { title, description, created_by } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO dossiers (title, description, created_by) VALUES (?, ?, ?)',
      [title, description, created_by]
    );
    res.status(201).json({ message: 'Dossier créé', id: result.insertId });
  } catch (error) {
    console.error('Erreur lors de la création du dossier:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  } 
});

// PUT /api/dossier/:id : Mettre à jour un dossier existant
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, created_by } = req.body;

  try {
    const result = await db.query(
      'UPDATE dossiers SET title = ?, description = ?, created_by = ? WHERE id = ?',
      [title, description, created_by, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Dossier non trouvé' });
    }

    res.json({ message: 'Dossier mis à jour' });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du dossier:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// DELETE /api/dossier/:id : Supprimer un dossier
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM dossiers WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Dossier non trouvé' });
    }
    res.json({ message: 'Dossier supprimé' });
  } catch (error) {
    console.error('Erreur lors de la suppression du dossier:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;