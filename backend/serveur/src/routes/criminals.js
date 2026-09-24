const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /api/criminals : Liste paginée
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const result = await db.query(
      'SELECT id, first_name, last_name, status, photo_url FROM criminal ORDER BY added_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    return res.json({ page, data: result.rows });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/criminals : Ajouter un dossier
router.post('/', async (req, res) => {
  const { first_name, last_name, date_of_birth, nationality, description, crimes, added_by } = req.body;

  try {
    // TODO: Valider les champs obligatoires
    // TODO: Effectuer l'INSERT dans la table criminal (version par défaut = 1)
    // TODO: Émettre l'événement Socket.IO "criminal:added" aux clients connectés

    return res.status(201).json({ message: 'Création à implémenter' });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

// TODO: Ajouter PATCH /:id (mise à jour statut + vérification version)
// TODO: Ajouter DELETE /:id (retrait par un superviseur)

module.exports = router;