import { Routes, Route } from 'react-router-dom';
import PrivateRoute from '../composants/PrivateRoute.jsx';
import Layout from '../composants/Layout.jsx';
import Auth from '../pages/Auth.jsx';
import Home from '../pages/Home.jsx';
import NoMatch from '../pages/NoMatch.jsx';

export default function Router() {
  return (
    <Routes>
      <Route path="/connexion" element={<Auth />} />

      <Route element={<PrivateRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="*" element={<NoMatch />} />
        </Route>
      </Route>
    </Routes>
  );
}
