import { NavLink } from 'react-router-dom';
import {
  IconeBouclier, IconeMaison, IconeRecherche, IconeSirene, IconeMegaphone,
  IconeMessage, IconeRepere, IconeStats, IconeGroupe,
} from './Icones.jsx';
import UserProfileMenu from './UserProfileMenu.jsx';

// aVenir : la page n'existe pas encore (elle affiche « Page en construction ») ; c'est signalé dans le menu
const sections = [
  {
    titre: 'Principal',
    liens: [
      { vers: '/', libelle: 'Accueil', Icone: IconeMaison, fin: true },
      { vers: '/personnes-recherchees', libelle: 'Personnes recherchées', Icone: IconeRecherche },
      { vers: '/alertes', libelle: 'Alertes', Icone: IconeSirene, aVenir: true },
      { vers: '/communiques', libelle: 'Communiqués', Icone: IconeMegaphone, aVenir: true },
      { vers: '/messagerie', libelle: 'Messagerie', Icone: IconeMessage, aVenir: true },
      { vers: '/annuaire', libelle: 'Annuaire', Icone: IconeRecherche, aVenir: true },
      { vers: '/carte', libelle: 'Carte', Icone: IconeRepere, aVenir: true },
    ],
  },
  {
    titre: 'Gestion',
    liens: [
      { vers: '/statistiques', libelle: 'Statistiques', Icone: IconeStats, aVenir: true },
      { vers: '/utilisateurs', libelle: 'Utilisateurs', Icone: IconeGroupe, aVenir: true },
    ],
  },
];

export default function Menu() {
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
            {section.liens.map(({ vers, libelle, Icone, fin, aVenir }) => (
              <NavLink key={vers} to={vers} end={fin} className="menu-lien">
                <Icone />
                <span>{libelle}</span>
                {aVenir && <span className="a-venir">À venir</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <UserProfileMenu />
    </aside>
  );
}
