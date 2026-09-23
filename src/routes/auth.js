const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Route POST /auth/login
router.post('/login', async (req, res) => {
  const { badge_number, password } = req.body;

  try {
    const result = await db.query(
      'SELECT id, first_name, last_name, badge_number, password_hash, role, grade FROM app_user WHERE badge_number = $1 AND is_active = true',
      [badge_number]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Identifiants invalides ou compte inactif' });
    }

    const user = result.rows[0];

    // TODO: Comparer le mot de passe avec bcrypt (ex: await bcrypt.compare(password, user.password_hash))
    // TODO: Générer un jeton JWT avec id, role et grade
    // TODO: Renvoyer le jeton dans le body ou dans un cookie HTTP-only

    return res.json({ message: 'Connexion réussie (à compléter)' });
  } catch (error) {
    console.error('Erreur lors du login:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;