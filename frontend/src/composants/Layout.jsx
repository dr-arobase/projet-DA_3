import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Menu from './Menu.jsx';
import NavMobile from './NavMobile.jsx';
import Notifications from './Notifications.jsx';
import AppelProvider from './AppelProvider.jsx';
import AppelGroupeProvider from './AppelGroupeProvider.jsx';
import { useTempsReel } from './TempsReelContext.js';
import useNonLus from '../hooks/useNonLus.js';
import { lireReglage, ecrireReglage } from '../reglages.js';

export default function Layout() {
  const { enLigne } = useTempsReel();
  const nonLus = useNonLus();
  const pastilles = { nonLus };
  const [reduit, setReduit] = useState(() => lireReglage('menu-reduit', false));

  function basculer() {
    setReduit((r) => {
      ecrireReglage('menu-reduit', !r);
      return !r;
    });
  }

  return (
    // Les appels (à deux et de groupe) sonnent sur toutes les pages de l'application
    <AppelProvider>
      <AppelGroupeProvider>
        <div className={`app${reduit ? ' menu-reduit' : ''}`}>
          <Menu reduit={reduit} onBasculer={basculer} pastilles={pastilles} />
          <main className="contenu">
            {!enLigne && <p className="registre-message erreur" role="status">Connexion temps réel interrompue. Reconnexion en cours…</p>}
            <Outlet />
          </main>
          <NavMobile pastilles={pastilles} />
          <Notifications />
        </div>
      </AppelGroupeProvider>
    </AppelProvider>
  );
}
