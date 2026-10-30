import { createContext, useContext } from 'react';

// Appels audio et vidéo à deux (#56) : appeler(agent, video) depuis n'importe quelle page
export const AppelContext = createContext({ appeler: () => {}, enAppel: false });

export const useAppel = () => useContext(AppelContext);
