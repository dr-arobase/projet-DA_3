import { Outlet } from 'react-router-dom';
import Menu from './Menu.jsx';
import Notifications from './Notifications.jsx';
import { useTempsReel } from './TempsReelContext.js';

export default function Layout() {
  const { enLigne } = useTempsReel();
  return (
    <div className="app">
      <Menu />
      <main className="contenu">
        {!enLigne && <p className="registre-message erreur" role="status">Connexion temps réel interrompue. Reconnexion en cours…</p>}
        <Outlet />
      </main>
      <Notifications />
    </div>
  );
}
