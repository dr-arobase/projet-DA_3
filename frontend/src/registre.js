// Valeurs partagées par les pages du registre (statuts de criminal.status, voir database/schema.sql)
export const STATUTS = ['recherche', 'capture', 'libere'];

export const LIBELLES_STATUT = {
  recherche: 'Recherché',
  capture: 'Capturé',
  libere: 'Libéré',
};

// Rôles qui peuvent retirer un dossier (même règle que DELETE /api/criminals/:id)
export const peutRetirer = (utilisateur) => ['superviseur', 'direction'].includes(utilisateur?.role);

export const nomComplet = (c) => `${c?.first_name ?? ''} ${c?.last_name ?? ''}`.trim();

export function formaterDate(iso, avecHeure = false) {
  if (!iso) return '—';
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  if (avecHeure) Object.assign(options, { hour: '2-digit', minute: '2-digit' });
  // Une date seule (AAAA-MM-JJ) est lue à midi pour ne pas reculer d'un jour selon le fuseau
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return date.toLocaleDateString('fr-CA', options);
}

// Colonne DATE (ex. date de naissance) : pg la renvoie à minuit dans le fuseau du serveur,
// on ne garde que AAAA-MM-JJ pour afficher le bon jour partout
export const formaterJour = (iso) => (iso ? formaterDate(String(iso).slice(0, 10)) : '—');
