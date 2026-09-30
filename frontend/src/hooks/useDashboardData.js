// Données du tableau de bord.
// Le backend n'expose pas encore de route de statistiques : on affiche les valeurs de la maquette.
// TODO : remplacer par des appels à l'API (ex. GET /api/stats, /api/alerts, /api/audit-logs).
const DONNEES = {
  stats: [
    { valeur: 128, libelle: 'Fiches actives' },
    { valeur: 6, libelle: 'Alertes du jour', ton: 'danger' },
    { valeur: 3, libelle: 'Messages non lus' },
    { valeur: 58, libelle: 'Agents en service', ton: 'succes' },
  ],
  activites: [
    { id: 1, type: 'alerte', titre: 'Observation signalée — K. Belhadj', auteur: 'Brig. Lefèvre', quand: 'il y a 4 min' },
    { id: 2, type: 'ajout', titre: 'Nouvelle fiche enregistrée', auteur: 'Vous', quand: 'il y a 1 h' },
    { id: 3, type: 'classee', titre: 'Fiche classée — S. Marchand', auteur: 'Lt. Diallo', quand: 'il y a 3 h' },
  ],
  dernierCommunique: {
    prioritaire: true,
    titre: 'Sécurisation du centre-ville',
    auteur: 'Comm. Div. P. Vasseur',
    heure: '08:00',
  },
  notifications: 3,
};

export default function useDashboardData() {
  return DONNEES;
}
