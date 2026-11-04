import { createContext, useContext } from 'react';

// Appels de groupe : rejoindre(groupe, video) depuis la messagerie; appelsEnCours = groupes où un appel a lieu
export const AppelGroupeContext = createContext({
  rejoindre: () => {},
  verifierAppel: () => {},
  appelGroupeId: null,
  appelsEnCours: new Set(),
});

export const useAppelGroupe = () => useContext(AppelGroupeContext);
