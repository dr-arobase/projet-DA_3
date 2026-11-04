import {
  IconeMaison, IconeRecherche, IconeRepere, IconeSirene, IconeMegaphone,
  IconeMessage, IconeGroupe, IconeStats, IconeAjoutPersonne,
} from './Icones.jsx';

// Liens de l'application, regroupés par usage (direction E) : sur le terrain, pour communiquer, pour gérer.
// Le menu latéral (ordinateur) et la barre du bas (téléphone) lisent la même liste.
// role : lien affiché seulement à partir de ce rôle (le serveur refuse de toute façon les autres)
// pastille : clé du compteur affiché à côté du lien (ex. messages non lus)
export const SECTIONS = [
  {
    id: 'terrain',
    titre: 'Terrain',
    liens: [
      { vers: '/', libelle: 'Accueil', court: 'Accueil', Icone: IconeMaison, fin: true },
      { vers: '/personnes-recherchees', libelle: 'Personnes recherchées', court: 'Registre', Icone: IconeRecherche },
      { vers: '/carte', libelle: 'Carte', court: 'Carte', Icone: IconeRepere },
    ],
  },
  {
    id: 'communication',
    titre: 'Communication',
    liens: [
      { vers: '/alertes', libelle: 'Alertes', Icone: IconeSirene },
      { vers: '/communiques', libelle: 'Communiqués', Icone: IconeMegaphone },
      { vers: '/messagerie', libelle: 'Messagerie', court: 'Messages', Icone: IconeMessage, pastille: 'nonLus' },
      { vers: '/annuaire', libelle: 'Annuaire', Icone: IconeGroupe },
    ],
  },
  {
    id: 'gestion',
    titre: 'Gestion',
    repliable: true,
    liens: [
      { vers: '/statistiques', libelle: 'Statistiques', Icone: IconeStats },
      { vers: '/utilisateurs', libelle: 'Utilisateurs', Icone: IconeAjoutPersonne, role: 'superviseur' },
    ],
  },
];

// Les quatre destinations les plus utilisées sur le terrain : toujours visibles en bas du téléphone.
// Le reste est dans « Plus ».
export const LIENS_BARRE_MOBILE = ['/', '/personnes-recherchees', '/carte', '/messagerie'];
