import { Routes, Route } from 'react-router-dom';
import PrivateRoute from '../composants/PrivateRoute.jsx';
import Layout from '../composants/Layout.jsx';
import { IconeMessage, IconeRepere } from '../composants/Icones.jsx';
import Auth from '../pages/auth.jsx';
import Home from '../pages/Home.jsx';
import Profil from '../pages/Profil.jsx';
import PersonnesRecherchees from '../pages/PersonnesRecherchees.jsx';
import FicheDossier from '../pages/FicheDossier.jsx';
import NouveauDossier from '../pages/NouveauDossier.jsx';
import Diffusions from '../pages/Diffusions.jsx';
import Annuaire from '../pages/Annuaire.jsx';
import Statistiques from '../pages/Statistiques.jsx';
import Utilisateurs from '../pages/Utilisateurs.jsx';
import PageAVenir from '../pages/PageAVenir.jsx';
import NoMatch from '../NoMatch.jsx';

export default function Router() {
  return (
    <Routes>
      <Route path="/connexion" element={<Auth />} />

      <Route element={<PrivateRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="profil" element={<Profil />} />
          <Route path="personnes-recherchees" element={<PersonnesRecherchees />} />
          <Route path="personnes-recherchees/nouvelle" element={<NouveauDossier />} />
          <Route path="personnes-recherchees/:id" element={<FicheDossier />} />
          {/* key : React repart d'une page neuve en passant d'Alertes à Communiqués */}
          <Route path="alertes" element={<Diffusions key="urgent" severite="urgent" />} />
          <Route path="communiques" element={<Diffusions key="info" severite="info" />} />
          <Route path="annuaire" element={<Annuaire />} />
          <Route path="statistiques" element={<Statistiques />} />
          <Route path="utilisateurs" element={<Utilisateurs />} />
          <Route
            path="messagerie"
            element={(
              <PageAVenir
                titre="Messagerie"
                Icone={IconeMessage}
                description="Échanger des messages privés entre agents."
                prevu="Récit Could, hors de la portée prévue pour les trois sprints."
              />
            )}
          />
          <Route
            path="carte"
            element={(
              <PageAVenir
                titre="Carte"
                Icone={IconeRepere}
                description="Voir sur une carte les lieux des signalements terrain."
                prevu="Récit #21 (Could), après les signalements terrain (#13) du sprint 2."
              />
            )}
          />
          <Route path="*" element={<NoMatch />} />
        </Route>
      </Route>
    </Routes>
  );
}
