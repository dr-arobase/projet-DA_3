import { Routes, Route } from 'react-router-dom';
import PrivateRoute from '../composants/PrivateRoute.jsx';
import Layout from '../composants/Layout.jsx';
import Auth from '../pages/auth.jsx';
import Home from '../pages/Home.jsx';
import Profil from '../pages/Profil.jsx';
import PersonnesRecherchees from '../pages/PersonnesRecherchees.jsx';
import FicheDossier from '../pages/FicheDossier.jsx';
import NouveauDossier from '../pages/NouveauDossier.jsx';
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
          <Route path="*" element={<NoMatch />} />
        </Route>
      </Route>
    </Routes>
  );
}
