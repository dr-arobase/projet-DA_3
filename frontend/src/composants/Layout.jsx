import { useEffect, useState } from 'react';
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
  const { enLigne, premiereConnexion } = useTempsReel();
  const nonLus = useNonLus();
  const pastilles = { nonLus };
  const [reduit, setReduit] = useState(() => lireReglage('menu-reduit', false));

  // CT-01 : la carte (Leaflet) se télécharge à part. Sur un réseau lent, la première visite restait
  // grise plusieurs secondes : on la prépare en arrière-plan dès que l'agent est connecté.
  useEffect(() => {
    const preparer = () => { import('../pages/Carte.jsx').catch(() => {}); };
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(preparer, { timeout: 4000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(preparer, 2000);
    return () => window.clearTimeout(id);
  }, []);

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
            {/* Pas pendant la première connexion, juste après s'être connecté : ce n'est pas une coupure */}
            {!enLigne && !premiereConnexion && <p className="registre-message erreur" role="status">Connexion temps réel interrompue. Reconnexion en cours…</p>}
            <Outlet />
          </main>
          <NavMobile pastilles={pastilles} />
          <Notifications />
        </div>
      </AppelGroupeProvider>
    </AppelProvider>
  );
}
