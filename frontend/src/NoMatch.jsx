import { Link, useLocation } from 'react-router-dom';
import './styles/pages.css';

// Adresse inconnue (404)
export default function NoMatch() {
  const { pathname } = useLocation();
  return (
    <div className="page pages-introuvable">
      <p className="pages-code">404</p>
      <h1>Page introuvable</h1>
      <p>L'adresse <code>{pathname}</code> ne correspond à aucune page de CrimeTracker.</p>
      <div className="pages-liens">
        <Link to="/">Tableau de bord</Link>
        <Link to="/personnes-recherchees">Personnes recherchées</Link>
      </div>
    </div>
  );
}
