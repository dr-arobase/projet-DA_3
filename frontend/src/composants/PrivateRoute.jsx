import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.js';

// Redirige vers /connexion si aucun jeton n'est présent
export default function PrivateRoute() {
  const { estConnecte } = useAuth();
  const location = useLocation();

  if (!estConnecte) {
    return <Navigate to="/connexion" replace state={{ depuis: location.pathname }} />;
  }
  return <Outlet />;
}
