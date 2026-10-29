import { useCallback, useEffect, useState } from 'react';
import * as api from '../api.js';
import { useAuth } from '../composants/AuthContext.js';
import { useEvenement, useTempsReel } from '../composants/TempsReelContext.js';

// Nombre de messages non lus de l'agent connecté, pour la pastille du lien « Messagerie ».
// Lu au chargement (messages reçus hors ligne), puis relu à chaque message reçu,
// à chaque lecture (événement messages:lus, aussi venu d'un autre onglet) et après une reconnexion.
export default function useNonLus() {
  const { utilisateur } = useAuth();
  const { reconnexions } = useTempsReel();
  const [nonLus, setNonLus] = useState(0);

  const charger = useCallback(() => {
    api.compterNonLus()
      .then(({ total }) => setNonLus(Number(total) || 0))
      .catch(() => {}); // la pastille n'est qu'un indice : une erreur ne doit rien bloquer
  }, []);

  useEffect(() => { charger(); }, [charger, reconnexions]);

  // Mes propres messages ne comptent pas
  useEvenement('message:new', useCallback((m) => {
    if (m.recipient_id === utilisateur?.id) charger();
  }, [utilisateur?.id, charger]));
  useEvenement('group:message', useCallback((m) => {
    if (m.sender_id !== utilisateur?.id) charger();
  }, [utilisateur?.id, charger]));
  useEvenement('group:updated', charger);
  useEvenement('messages:lus', charger);

  return nonLus;
}
