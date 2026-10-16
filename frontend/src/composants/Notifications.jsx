import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.js';
import { useEvenement } from './TempsReelContext.js';
import { IconeSirene, IconeMegaphone } from './Icones.jsx';

const DUREE_COMMUNIQUE = 8000; // un communiqué disparaît seul; une alerte urgente reste jusqu'à ce qu'on la ferme
const MAX_AFFICHEES = 4;

const PAGE = { urgent: '/alertes', info: '/communiques' };

// Alertes et communiqués diffusés par les autres agents (#63), sur n'importe quelle page.
// Onglet en arrière-plan : notification du navigateur aussi, si l'agent l'a autorisée.
export default function Notifications() {
  const { utilisateur } = useAuth();
  const navigate = useNavigate();
  const [liste, setListe] = useState([]);
  const [permission, setPermission] = useState(() => ('Notification' in window ? Notification.permission : 'denied'));

  const fermer = useCallback((id) => setListe((enCours) => enCours.filter((n) => n.id !== id)), []);

  useEvenement('alert:broadcast', useCallback((a) => {
    if (a.issued_by_id === utilisateur.id) return; // on ne se notifie pas soi-même
    setListe((enCours) => [a, ...enCours.filter((n) => n.id !== a.id)].slice(0, MAX_AFFICHEES));

    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      const titre = a.severity === 'urgent' ? 'Alerte urgente' : 'Communiqué';
      const notif = new Notification(`${titre} · ${a.issued_by ?? 'CrimeTracker'}`, { body: a.message, tag: `alerte-${a.id}` });
      notif.onclick = () => {
        window.focus();
        navigate(PAGE[a.severity] ?? '/alertes');
        notif.close();
      };
    }
  }, [utilisateur.id, navigate]));

  // Les communiqués se ferment seuls
  useEffect(() => {
    const minuteries = liste
      .filter((n) => n.severity !== 'urgent')
      .map((n) => setTimeout(() => fermer(n.id), DUREE_COMMUNIQUE));
    return () => minuteries.forEach(clearTimeout);
  }, [liste, fermer]);

  async function autoriser() {
    setPermission(await Notification.requestPermission());
  }

  if (liste.length === 0) return null;

  return (
    <div className="notifications" aria-live="assertive">
      {liste.map((n) => {
        const urgent = n.severity === 'urgent';
        return (
          <div key={n.id} className={`notification${urgent ? ' urgente' : ''}`} role={urgent ? 'alert' : 'status'}>
            <button
              type="button"
              className="notification-corps"
              onClick={() => {
                fermer(n.id);
                navigate(PAGE[n.severity] ?? '/alertes');
              }}
            >
              <span className="notification-icone" aria-hidden="true">
                {urgent ? <IconeSirene taille={18} /> : <IconeMegaphone taille={18} />}
              </span>
              <span>
                <strong>{urgent ? 'Alerte urgente' : 'Communiqué'}</strong>
                <small>{n.issued_by}</small>
                <span className="notification-message">{n.message}</span>
              </span>
            </button>
            <button type="button" className="notification-fermer" aria-label="Fermer" onClick={() => fermer(n.id)}>×</button>
          </div>
        );
      })}
      {permission === 'default' && (
        <button type="button" className="notification-permission" onClick={autoriser}>
          Recevoir aussi les alertes quand l'onglet n'est pas affiché
        </button>
      )}
    </div>
  );
}
