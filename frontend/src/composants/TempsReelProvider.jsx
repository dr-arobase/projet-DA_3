import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { TempsReelContext } from './TempsReelContext.js';
import { useAuth } from './AuthContext.js';
import { API_URL } from '../config.js';

// Une seule connexion Socket.IO tant que l'agent est connecté.
// Le serveur l'authentifie avec le cookie de session (même origine grâce au proxy Vite).
export default function TempsReelProvider({ children }) {
  const { estConnecte } = useAuth();
  const [socket, setSocket] = useState(null);
  const [enLigne, setEnLigne] = useState(false);
  const [presence, setPresence] = useState([]);
  const [reconnexions, setReconnexions] = useState(0);
  const [reconnexionRecuperee, setReconnexionRecuperee] = useState(false);
  const dejaConnecte = useRef(false);

  useEffect(() => {
    if (!estConnecte) return undefined;

    // Sans API_URL : même origine que la page (nginx ou proxy Vite)
    const s = API_URL ? io(API_URL, { withCredentials: true }) : io({ withCredentials: true });
    s.on('connect', () => {
      setEnLigne(true);
      if (dejaConnecte.current) {
        setReconnexions((n) => n + 1);
        setReconnexionRecuperee(s.recovered);
      } else {
        dejaConnecte.current = true;
        setReconnexionRecuperee(false);
      }
    });
    s.on('disconnect', () => setEnLigne(false));
    s.on('presence:update', setPresence);
    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
      setEnLigne(false);
      setPresence([]);
      setReconnexions(0);
      setReconnexionRecuperee(false);
      dejaConnecte.current = false;
    };
  }, [estConnecte]);

  // Un agent peut avoir plusieurs onglets ouverts : on compte les agents, pas les connexions
  const agentsConnectes = new Set(presence.map((p) => p.id)).size;

  return (
    <TempsReelContext.Provider value={{
      socket, enLigne, presence, agentsConnectes, reconnexions, reconnexionRecuperee,
    }}>
      {children}
    </TempsReelContext.Provider>
  );
}
