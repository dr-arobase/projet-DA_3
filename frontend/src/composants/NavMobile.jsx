import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { IconePoints, IconeUtilisateur, IconeDeconnexion } from './Icones.jsx';
import { useAuth } from './AuthContext.js';
import { estAuMoins } from '../agents.js';
import { SECTIONS, LIENS_BARRE_MOBILE } from './navigation.js';

// Barre de navigation du bas, sur téléphone : les quatre destinations du terrain à portée de pouce,
// et « Plus » qui ouvre une feuille avec le reste du menu, le profil et la déconnexion.
export default function NavMobile({ pastilles }) {
  const { utilisateur, seDeconnecter } = useAuth();
  const [plusOuvert, setPlusOuvert] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const feuille = useRef(null);

  const tous = SECTIONS.flatMap((s) => s.liens).filter(({ role }) => !role || estAuMoins(utilisateur, role));
  const barre = LIENS_BARRE_MOBILE.map((vers) => tous.find((l) => l.vers === vers)).filter(Boolean);
  const autres = tous.filter((l) => !LIENS_BARRE_MOBILE.includes(l.vers));
  const plusActif = autres.some((l) => pathname.startsWith(l.vers)) || pathname.startsWith('/profil');

  // Une page choisie dans la feuille la referme
  useEffect(() => { setPlusOuvert(false); }, [pathname]);

  useEffect(() => {
    if (!plusOuvert) return undefined;
    feuille.current?.querySelector('a, button')?.focus();
    const echap = (e) => e.key === 'Escape' && setPlusOuvert(false);
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [plusOuvert]);

  async function quitter() {
    await seDeconnecter();
    navigate('/connexion', { replace: true });
  }

  const pastille = (cle) => {
    const n = cle ? pastilles[cle] ?? 0 : 0;
    return n > 0 ? <span className="nav-mobile-pastille" aria-label={`${n} non lu${n > 1 ? 's' : ''}`}>{n > 99 ? '99+' : n}</span> : null;
  };

  return (
    <>
      {plusOuvert && (
        <div className="nav-mobile-voile" onClick={() => setPlusOuvert(false)} aria-hidden="true" />
      )}
      {plusOuvert && (
        <div className="nav-mobile-feuille" id="nav-mobile-plus" ref={feuille} role="dialog" aria-modal="true" aria-label="Autres pages">
          <ul>
            {autres.map(({ vers, libelle, Icone, pastille: cle }) => (
              <li key={vers}>
                <NavLink to={vers} className="nav-mobile-ligne"><Icone taille={20} /><span>{libelle}</span>{pastille(cle)}</NavLink>
              </li>
            ))}
            <li><NavLink to="/profil" className="nav-mobile-ligne"><IconeUtilisateur taille={20} /><span>Mon profil</span></NavLink></li>
            <li>
              <button type="button" className="nav-mobile-ligne danger" onClick={quitter}>
                <IconeDeconnexion taille={20} /><span>Se déconnecter</span>
              </button>
            </li>
          </ul>
        </div>
      )}

      <nav className="nav-mobile" aria-label="Navigation principale">
        {barre.map(({ vers, libelle, court, Icone, fin, pastille: cle }) => (
          <NavLink key={vers} to={vers} end={fin} className="nav-mobile-lien" aria-label={libelle}>
            <Icone taille={22} />
            <span aria-hidden="true">{court ?? libelle}</span>
            {pastille(cle)}
          </NavLink>
        ))}
        <button
          type="button"
          className={`nav-mobile-lien${plusActif ? ' active' : ''}`}
          onClick={() => setPlusOuvert((o) => !o)}
          aria-expanded={plusOuvert}
          aria-controls="nav-mobile-plus"
        >
          <IconePoints taille={22} />
          <span>Plus</span>
        </button>
      </nav>
    </>
  );
}
