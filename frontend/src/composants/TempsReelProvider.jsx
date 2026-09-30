import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { TempsReelContext } from './TempsReelContext.js';
import { useAuth } from './AuthContext.js';

// Une seule connexion Socket.IO tant que l'agent est connecté.
// Le serveur l'authentifie avec le cookie de session (même origine grâce au proxy Vite).
export default function TempsReelProvider({ children }) {
  const { estConnecte } = useAuth();
  const [socket, setSocket] = useState(null);
  const [enLigne, setEnLigne] = useState(false);
  const [presence, setPresence] = useState([]);

  useEffect(() => {
    if (!estConnecte) return undefined;

    const s = io({ withCredentials: true });
    s.on('connect', () => setEnLigne(true));
    s.on('disconnect', () => setEnLigne(false));
    s.on('presence:update', setPresence);
    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
      setEnLigne(false);
      setPresence([]);
    };
  }, [estConnecte]);

  // Un agent peut avoir plusieurs onglets ouverts : on compte les agents, pas les connexions
  const agentsConnectes = new Set(presence.map((p) => p.id)).size;

  return (
    <TempsReelContext.Provider value={{ socket, enLigne, presence, agentsConnectes }}>
      {children}
    </TempsReelContext.Provider>
  );
}
