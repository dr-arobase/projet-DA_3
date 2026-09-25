const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Route POST /auth/login
router.post('/login', async (req, res) => {
  const { badge_number, password } = req.body;

  // 1. Validation basique des données d'entrée
  if (!badge_number || !password) {
    return res.status(400).json({ message: 'Le matricule et le mot de passe sont requis' });
  }

  try {
    // 2. Recherche de l'utilisateur actif
    const result = await db.query(
      'SELECT id, first_name, last_name, badge_number, password_hash, role, grade FROM app_user WHERE badge_number = $1 AND is_active = true',
      [badge_number]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Identifiants invalides ou compte inactif' });
    }

    const user = result.rows[0];

    // 3. Vérification du mot de passe avec bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Identifiants invalides ou compte inactif' });
    }

    // 4. Clé secrète JWT (à définir dans le fichier .env)
    const jwtSecret = process.env.JWT_SECRET || 'super_secret_key_change_me';

    // 5. Génération du jeton JWT avec le payload (id, role, grade)
    const token = jwt.sign(
      {
        id: user.id,
        badge_number: user.badge_number,
        role: user.role,
        grade: user.grade
      },
      jwtSecret,
      { expiresIn: '8h' } // Expiration à 8 heures (durée d'un quart de travail)
    );

    // 6. Réponse avec le jeton et les infos de profil de l'agent
    return res.json({
      message: 'Connexion réussie',
      token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        badge_number: user.badge_number,
        role: user.role,
        grade: user.grade
      }
    });

  } catch (error) {
    console.error('Erreur lors du login:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;