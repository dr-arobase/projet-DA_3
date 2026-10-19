import { NavLink } from 'react-router-dom';
import {
  IconeBouclier, IconeMaison, IconeRecherche, IconeSirene, IconeMegaphone,
  IconeMessage, IconeRepere, IconeStats, IconeGroupe,
} from './Icones.jsx';
import UserProfileMenu from './UserProfileMenu.jsx';
import { useAuth } from './AuthContext.js';
import { estAuMoins } from '../agents.js';

// role : lien affiché seulement à partir de ce rôle (le serveur refuse de toute façon les autres)
const sections = [
  {
    titre: 'Principal',
    liens: [
      { vers: '/', libelle: 'Accueil', Icone: IconeMaison, fin: true },
      { vers: '/personnes-recherchees', libelle: 'Personnes recherchées', Icone: IconeRecherche },
      { vers: '/alertes', libelle: 'Alertes', Icone: IconeSirene },
      { vers: '/communiques', libelle: 'Communiqués', Icone: IconeMegaphone },
      { vers: '/messagerie', libelle: 'Messagerie', Icone: IconeMessage },
      { vers: '/annuaire', libelle: 'Annuaire', Icone: IconeRecherche },
      { vers: '/carte', libelle: 'Carte', Icone: IconeRepere },
    ],
  },
  {
    titre: 'Gestion',
    liens: [
      { vers: '/statistiques', libelle: 'Statistiques', Icone: IconeStats },
      { vers: '/utilisateurs', libelle: 'Utilisateurs', Icone: IconeGroupe, role: 'superviseur' },
    ],
  },
];

export default function Menu() {
  const { utilisateur } = useAuth();

  return (
    <aside className="menu">
      <div className="menu-marque">
        <span className="logo-carre"><IconeBouclier /></span>
        <span>SentinelleRP</span>
      </div>

      <nav className="menu-nav">
        {sections.map((section) => (
          <div key={section.titre} className="menu-section">
            <p className="menu-titre">{section.titre}</p>
            {section.liens
              .filter(({ role }) => !role || estAuMoins(utilisateur, role))
              .map(({ vers, libelle, Icone, fin }) => (
                <NavLink key={vers} to={vers} end={fin} className="menu-lien">
                  <Icone />
                  <span>{libelle}</span>
                </NavLink>
              ))}
          </div>
        ))}
      </nav>

      <UserProfileMenu />
    </aside>
  );
}
