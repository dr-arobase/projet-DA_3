import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.js';
import { LIBELLES_ROLE } from '../agents.js';
import { IconeChevron, IconeDeconnexion, IconeUtilisateur } from './Icones.jsx';
import Avatar from './Avatar.jsx';

// Valeurs de app_user.role et app_user.grade (voir database/seed.sql)
const ABREVIATIONS_GRADE = {
  directeur_general: 'Dir.',
  directeur_general_adjoint: 'DGA',
  lieutenant: 'Lt.',
  capitaine: 'Cap.',
  sergent_gestionnaire: 'Sgt. gest.',
  sergent_responsable_de_poste: 'Sgt. resp.',
  sergent_autres_fonctions: 'Sgt.',
  inspecteur: 'Insp.',
  inspecteur_chef: 'Insp.-chef',
};

export default function UserProfileMenu({ reduit = false }) {
  const { utilisateur, seDeconnecter } = useAuth();
  const [ouvert, setOuvert] = useState(false);
  const navigate = useNavigate();
  const menu = useRef(null);

  useEffect(() => {
    const fermer = (event) => {
      if (!menu.current?.contains(event.target)) setOuvert(false);
    };
    const echap = (event) => event.key === 'Escape' && setOuvert(false);
    document.addEventListener('mousedown', fermer);
    document.addEventListener('keydown', echap);
    return () => {
      document.removeEventListener('mousedown', fermer);
      document.removeEventListener('keydown', echap);
    };
  }, []);

  const prenom = utilisateur?.first_name ?? '';
  const nom = utilisateur?.last_name ?? '';
  const nomAffiche = [ABREVIATIONS_GRADE[utilisateur?.grade], prenom, nom].filter(Boolean).join(' ');
  const role = LIBELLES_ROLE[utilisateur?.role?.toLowerCase()] ?? utilisateur?.role ?? '';

  async function quitter() {
    await seDeconnecter();
    navigate('/connexion', { replace: true });
  }

  return (
    <div className="profil" ref={menu}>
      {/* Carte qui s'ouvre au-dessus du bouton, comme un menu d'application */}
      {ouvert && (
        <div className="profil-menu" role="menu" id="profil-menu">
          <Link to="/profil" className="profil-action" role="menuitem" onClick={() => setOuvert(false)}>
            <IconeUtilisateur taille={16} /> Mon profil
          </Link>
          <button type="button" className="profil-action deconnexion" role="menuitem" onClick={quitter}>
            <IconeDeconnexion taille={16} /> Se déconnecter
          </button>
        </div>
      )}
      <button
        type="button"
        className="profil-bouton"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-haspopup="menu"
        aria-controls="profil-menu"
        title={reduit ? `${nomAffiche} · ${role}` : undefined}
      >
        <Avatar utilisateur={utilisateur} />
        {reduit ? <span className="visuellement-cache">{nomAffiche}, {role}</span> : (
          <>
            <span className="profil-texte menu-texte">
              <strong>{nomAffiche}</strong>
              <small>{utilisateur?.badge_number ? `${utilisateur.badge_number} · ${role}` : role}</small>
            </span>
            <IconeChevron taille={16} className={ouvert ? 'chevron ouvert' : 'chevron'} />
          </>
        )}
      </button>
    </div>
  );
}
