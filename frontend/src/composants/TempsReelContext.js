import { createContext, useContext, useEffect } from 'react';

export const TempsReelContext = createContext(null);

export const useTempsReel = () => useContext(TempsReelContext);

// Exécute handler à chaque événement Socket.IO reçu (ex. 'criminal:added')
export function useEvenement(evenement, handler) {
  const { socket } = useTempsReel();
  useEffect(() => {
    if (!socket) return undefined;
    socket.on(evenement, handler);
    return () => socket.off(evenement, handler);
  }, [socket, evenement, handler]);
}
