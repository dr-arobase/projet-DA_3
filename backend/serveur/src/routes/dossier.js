const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Route GET /api/dossiers (Récupérer tous les criminels pour que le front-end les trie)
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM criminal ORDER BY added_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des dossiers:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route GET /api/dossiers/:id (Récupérer un dossier spécifique)
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

// Route POST /api/dossiers (Ajouter un nouveau dossier)
router.post('/', async (req, res) => {
  const { first_name, last_name, description, status, added_by } = req.body;

  try {
    const query = `
      INSERT INTO criminal (first_name, last_name, description, status, added_by) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING *
    `;
    // Le statut par défaut peut être 'WANTED' si non précisé
    const values = [first_name, last_name, description, status || 'WANTED', added_by];
    
    const result = await db.query(query, values);

    res.status(201).json({ 
      message: 'Dossier créé avec succès', 
      criminal: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur lors de la création du dossier:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route PUT /api/dossiers/:id (Mettre à jour les infos d'un criminel)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, description, status } = req.body;

  try {
    const query = `
      UPDATE criminal 
      SET first_name = $1, last_name = $2, description = $3, status = $4, updated_at = NOW() 
      WHERE id = $5
      RETURNING *
    `;
    const result = await db.query(query, [first_name, last_name, description, status, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Dossier non trouvé' });
    }

    res.json({ 
      message: 'Dossier mis à jour avec succès',
      criminal: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du dossier:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route PATCH /api/dossiers/:id/status (Changer uniquement le statut si besoin)
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ message: 'Le paramètre status est requis' });
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

    res.json({ 
      message: 'Statut mis à jour avec succès', 
      criminal: result.rows[0] 
    });
  } catch (error) {
    console.error('Erreur lors du changement de statut:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;