// Données du tableau de bord, lues dans l'API puis tenues à jour en temps réel :
// chaque événement Socket.IO (dossier ajouté / modifié / retiré, alerte diffusée)
// ajoute une ligne d'activité et relance le calcul des compteurs.
import { useCallback, useEffect, useState } from 'react';
import * as api from '../api.js';
import { useEvenement, useTempsReel } from '../composants/TempsReelContext.js';

const NB_ACTIVITES = 6;

const LIBELLES_STATUT = { recherche: 'Recherché', capture: 'Capturé', libere: 'Libéré' };

const nomComplet = (c) => `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim();

function ilYA(date) {
  const secondes = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
  if (secondes < 60) return "à l'instant";
  if (secondes < 3600) return `il y a ${Math.floor(secondes / 60)} min`;
  if (secondes < 86400) return `il y a ${Math.floor(secondes / 3600)} h`;
  return `il y a ${Math.floor(secondes / 86400)} j`;
}

const estAujourdhui = (date) => new Date(date).toDateString() === new Date().toDateString();

const activiteAlerte = (a) => ({
  id: `alerte-${a.id}`, type: 'alerte', date: a.created_at,
  titre: a.message, auteur: a.issued_by ?? '—',
});

const activiteAjout = (c) => ({
  id: `ajout-${c.id}`, type: 'ajout', date: c.added_at,
  titre: `Nouvelle fiche — ${nomComplet(c)}`, auteur: c.added_by ?? '—',
});

// Tri du plus récent au plus ancien, sans doublon (un même id reçu deux fois)
function fusionner(...listes) {
  const parId = new Map();
  for (const a of listes.flat()) if (!parId.has(a.id)) parId.set(a.id, a);
  return [...parId.values()]
    .sort((x, y) => new Date(y.date) - new Date(x.date))
    .slice(0, NB_ACTIVITES);
}

export default function useDashboardData() {
  const { agentsConnectes } = useTempsReel();
  const [compteurs, setCompteurs] = useState({ recherches: 0, captures: 0 });
  const [alertes, setAlertes] = useState([]);
  const [activites, setActivites] = useState([]);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    try {
      const [recherches, captures, recents, listeAlertes] = await Promise.all([
        api.listerCriminels({ status: 'recherche', limit: 1 }),
        api.listerCriminels({ status: 'capture', limit: 1 }),
        api.listerCriminels({ limit: NB_ACTIVITES }),
        api.listerAlertes({ limit: 50 }),
      ]);
      setCompteurs({ recherches: recherches.total, captures: captures.total });
      setAlertes(listeAlertes.data);
      setActivites((enCours) => fusionner(
        enCours,
        recents.data.map(activiteAjout),
        listeAlertes.data.map(activiteAlerte),
      ));
      setErreur('');
    } catch (err) {
      setErreur(err.message);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const ajouter = (activite) => setActivites((enCours) => fusionner([activite], enCours));

  useEvenement('criminal:added', useCallback((c) => {
    ajouter(activiteAjout(c));
    charger();
  }, [charger]));

  useEvenement('criminal:updated', useCallback((c) => {
    ajouter({
      id: `maj-${c.id}-${c.version}`, type: c.status === 'recherche' ? 'ajout' : 'classee',
      date: c.updated_at ?? new Date().toISOString(),
      titre: `${LIBELLES_STATUT[c.status] ?? 'Fiche modifiée'} — ${nomComplet(c)}`,
      auteur: c.updated_by ?? '—',
    });
    charger();
  }, [charger]));

  useEvenement('criminal:removed', useCallback(({ id }) => {
    ajouter({
      id: `retrait-${id}`, type: 'classee', date: new Date().toISOString(),
      titre: `Fiche n° ${id} retirée du registre`, auteur: '—',
    });
    charger();
  }, [charger]));

  useEvenement('alert:broadcast', useCallback((a) => {
    setAlertes((enCours) => [a, ...enCours.filter((x) => x.id !== a.id)]);
    ajouter(activiteAlerte(a));
  }, []));

  const alertesDuJour = alertes.filter((a) => estAujourdhui(a.created_at));
  const derniere = alertes[0];

  return {
    erreur,
    stats: [
      { valeur: compteurs.recherches, libelle: 'Fiches actives' },
      { valeur: alertesDuJour.length, libelle: 'Alertes du jour', ton: 'danger' },
      { valeur: compteurs.captures, libelle: 'Fiches capturées' },
      { valeur: agentsConnectes, libelle: 'Agents connectés', ton: 'succes' },
    ],
    activites: activites.map((a) => ({ ...a, quand: ilYA(a.date) })),
    dernierCommunique: derniere && {
      prioritaire: derniere.severity === 'urgent',
      titre: derniere.message,
      auteur: derniere.issued_by ?? '—',
      heure: new Date(derniere.created_at).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' }),
    },
    notifications: alertesDuJour.filter((a) => a.severity === 'urgent').length,
  };
}
