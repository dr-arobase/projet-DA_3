import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { IconeBouclier, IconeChevron } from './Icones.jsx';
import UserProfileMenu from './UserProfileMenu.jsx';
import { useAuth } from './AuthContext.js';
import { useTempsReel } from './TempsReelContext.js';
import { estAuMoins } from '../agents.js';
import { SECTIONS } from './navigation.js';
import { lireReglage, ecrireReglage } from '../reglages.js';

// Menu latéral (ordinateur et tablette). Réductible à une colonne d'icônes ; le choix est gardé
// dans le navigateur. Sur téléphone, il est remplacé par la barre du bas (NavMobile).
export default function Menu({ reduit, onBasculer, pastilles }) {
  const { utilisateur } = useAuth();
  const { enLigne, agentsConnectes } = useTempsReel();
  const [gestionOuverte, setGestionOuverte] = useState(() => lireReglage('menu-gestion', true));

  function basculerGestion() {
    setGestionOuverte((o) => {
      ecrireReglage('menu-gestion', !o);
      return !o;
    });
  }

  return (
    <aside className="menu" aria-label="Menu principal">
      <div className="menu-marque">
        <span className="logo-carre"><IconeBouclier /></span>
        {!reduit && <strong className="menu-texte">CrimeTracker</strong>}
      </div>

      <button
        type="button"
        className="menu-bascule"
        onClick={onBasculer}
        aria-expanded={!reduit}
        aria-label={reduit ? 'Agrandir le menu' : 'Réduire le menu'}
        title={reduit ? 'Agrandir le menu' : undefined}
      >
        <IconeChevron taille={18} />
        {!reduit && <span className="menu-texte">Réduire le menu</span>}
      </button>

      {/* L'agent sait d'un coup d'œil s'il reçoit les alertes en direct */}
      <p className={`menu-direct${enLigne ? '' : ' coupe'}`} role="status" title={reduit ? etatDirect(enLigne, agentsConnectes) : undefined}>
        <span className="menu-direct-point" aria-hidden="true" />
        {!reduit && <span className="menu-texte">{etatDirect(enLigne, agentsConnectes)}</span>}
        {reduit && <span className="visuellement-cache">{etatDirect(enLigne, agentsConnectes)}</span>}
      </p>

      <nav className="menu-nav">
        {SECTIONS.map((section) => {
          const liens = section.liens.filter(({ role }) => !role || estAuMoins(utilisateur, role));
          if (liens.length === 0) return null;
          // Menu réduit : pas de titres, toutes les icônes restent visibles
          const ouverte = reduit || !section.repliable || gestionOuverte;
          const idListe = `menu-section-${section.id}`;
          return (
            <div key={section.id} className="menu-section">
              {!reduit && (section.repliable ? (
                <button type="button" className="menu-titre" onClick={basculerGestion} aria-expanded={ouverte} aria-controls={idListe}>
                  {section.titre}
                  <IconeChevron taille={14} className={`menu-fleche${ouverte ? ' ouverte' : ''}`} />
                </button>
              ) : (
                <p className="menu-titre">{section.titre}</p>
              ))}
              <div id={idListe} className={`menu-groupe${ouverte ? ' ouvert' : ''}`} inert={ouverte ? undefined : true}>
                <div>
                  {liens.map(({ vers, libelle, Icone, fin, pastille }) => {
                    const nombre = pastille ? pastilles[pastille] ?? 0 : 0;
                    const texteNombre = nombre > 99 ? '99+' : String(nombre);
                    return (
                      <NavLink
                        key={vers}
                        to={vers}
                        end={fin}
                        className="menu-lien"
                        title={reduit ? (nombre ? `${libelle} (${texteNombre} non lus)` : libelle) : undefined}
                      >
                        <span className="menu-barre" aria-hidden="true" />
                        <Icone taille={20} />
                        {reduit
                          ? <span className="visuellement-cache">{libelle}</span>
                          : <span className="menu-texte menu-libelle">{libelle}</span>}
                        {nombre > 0 && (
                          <span
                            className={reduit ? 'menu-point' : 'menu-pastille'}
                            aria-label={`${texteNombre} message${nombre > 1 ? 's' : ''} non lu${nombre > 1 ? 's' : ''}`}
                          >
                            {reduit ? '' : texteNombre}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      <UserProfileMenu reduit={reduit} />
    </aside>
  );
}

function etatDirect(enLigne, agents) {
  if (!enLigne) return 'Temps réel coupé · reconnexion…';
  return `Temps réel connecté · ${agents} agent${agents > 1 ? 's' : ''}`;
}
