import { Link } from 'react-router-dom';

// Page affichée pour les sections pas encore développées ou les URL inconnues
export default function NoMatch() {
  return (
    <div className="page page-vide">
      <h1>Page en construction</h1>
      <p>Cette section n'est pas encore disponible.</p>
      <Link to="/">Retour au tableau de bord</Link>
    </div>
  );
}
