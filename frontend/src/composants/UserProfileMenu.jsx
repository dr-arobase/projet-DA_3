import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.js';
import { IconeChevron, IconeDeconnexion, IconeUtilisateur } from './Icones.jsx';
import Avatar from './Avatar.jsx';

// Valeurs de app_user.role et app_user.grade (voir database/seed.sql)
const LIBELLES_ROLE = {
  direction: 'Direction',
  superviseur: 'Superviseur',
  policier: 'Policier',
};

const ABREVIATIONS_GRADE = {
  directeur_general: 'Dir.',
  lieutenant: 'Lt.',
  capitaine: 'Cap.',
  sergent: 'Sgt.',
  sergent_autres_fonctions: 'Sgt.',
};

export default function UserProfileMenu() {
  const { utilisateur, seDeconnecter } = useAuth();
  const [ouvert, setOuvert] = useState(false);
  const navigate = useNavigate();

  const prenom = utilisateur?.first_name ?? '';
  const nom = utilisateur?.last_name ?? '';
  const nomAffiche = [ABREVIATIONS_GRADE[utilisateur?.grade], prenom, nom].filter(Boolean).join(' ');
  const role = LIBELLES_ROLE[utilisateur?.role?.toLowerCase()] ?? utilisateur?.role ?? '';

  async function quitter() {
    await seDeconnecter();
    navigate('/connexion', { replace: true });
  }

  return (
    <div className="profil">
      {ouvert && (
        <>
          <Link to="/profil" className="profil-action" onClick={() => setOuvert(false)}>
            <IconeUtilisateur taille={16} /> Mon profil
          </Link>
          <button type="button" className="profil-action deconnexion" onClick={quitter}>
            <IconeDeconnexion taille={16} /> Se déconnecter
          </button>
        </>
      )}
      <button
        type="button"
        className="profil-bouton"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
      >
        <Avatar utilisateur={utilisateur} />
        <span className="profil-texte">
          <strong>{nomAffiche}</strong>
          <small>{role}</small>
        </span>
        <IconeChevron taille={16} className={ouvert ? 'chevron ouvert' : 'chevron'} />
      </button>
    </div>
  );
}
