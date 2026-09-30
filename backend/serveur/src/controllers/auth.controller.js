import * as authService from '../services/auth.service.js';

export const login = async (req, res) => {
  const { badge_number, password } = req.body;

  // Validation basique des entrées
  if (!badge_number || !password) {
    return res.status(400).json({ message: 'Le matricule et le mot de passe sont requis' });
  }

  try {
    const data = await authService.loginUser(badge_number, password);
    return res.json(data);
  } catch (error) {
    // Gestion des erreurs métiers renvoyées par le service
    if (error.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ message: 'Identifiants invalides ou compte inactif' });
    }

    console.error('Erreur lors du login:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};