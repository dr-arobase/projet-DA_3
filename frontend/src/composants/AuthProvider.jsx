import { useEffect, useState } from 'react';
import { AuthContext } from './AuthContext.js';
import * as api from '../api.js';
import { lireSession, enregistrerSession, effacerSession } from '../session.js';

export default function AuthProvider({ children }) {
  // L'utilisateur mémorisé permet d'afficher l'interface tout de suite ;
  // le cookie de session reste la seule preuve de connexion côté serveur.
  const [utilisateur, setUtilisateur] = useState(lireSession);

  // Au chargement, on vérifie que le cookie est encore valide
  useEffect(() => {
    if (!lireSession()) return;
    api.moi()
      .then(({ user }) => setUtilisateur(user))
      .catch((err) => {
        // 401 : pas de cookie ou compte inactif ; 403 : jeton expiré ou invalide
        if (err.status === 401 || err.status === 403) {
          effacerSession();
          setUtilisateur(null);
        }
      });
  }, []);

  async function seConnecter(matricule, motDePasse, seSouvenir) {
    const { user } = await api.connexion(matricule, motDePasse, seSouvenir);
    enregistrerSession(user, seSouvenir);
    setUtilisateur(user);
    return user;
  }

  async function seDeconnecter() {
    try {
      await api.deconnexion();
    } catch {
      // On oublie l'utilisateur côté client même si le serveur ne répond pas
    }
    effacerSession();
    setUtilisateur(null);
  }

  const valeur = {
    utilisateur,
    estConnecte: Boolean(utilisateur),
    seConnecter,
    seDeconnecter,
  };

  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>;
}
