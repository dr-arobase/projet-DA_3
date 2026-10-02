import { Routes, Route } from 'react-router-dom';
import PrivateRoute from '../composants/PrivateRoute.jsx';
import Layout from '../composants/Layout.jsx';
import Auth from '../pages/auth.jsx';
import Home from '../pages/Home.jsx';
import Profil from '../pages/Profil.jsx';
import NoMatch from '../NoMatch.jsx';

export default function Router() {
  return (
    <Routes>
      <Route path="/connexion" element={<Auth />} />

      <Route element={<PrivateRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="profil" element={<Profil />} />
          <Route path="*" element={<NoMatch />} />
        </Route>
      </Route>
    </Routes>
  );
}
