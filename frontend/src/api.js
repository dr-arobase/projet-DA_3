// Appel générique vers le backend. La session est un cookie httpOnly posé par le serveur :
// le navigateur l'envoie tout seul (même origine grâce au proxy Vite), on ne manipule aucun jeton.
// body : un objet (envoyé en JSON) ou un fichier (envoyé tel quel, avec son type MIME).
export async function requete(chemin, { method = 'GET', body } = {}) {
  const fichier = body instanceof Blob;
  let reponse;
  try {
    reponse = await fetch(chemin, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': fichier ? body.type : 'application/json' } : undefined,
      body: body ? (fichier ? body : JSON.stringify(body)) : undefined,
    });
  } catch {
    throw new Error('Serveur injoignable. Vérifiez que le backend est démarré.');
  }

  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    // Réponse vide en 5xx : en développement, le proxy Vite renvoie 500 quand le backend est arrêté
    const parDefaut = reponse.status >= 500
      ? 'Erreur serveur. Vérifiez que le backend est démarré.'
      : `Erreur ${reponse.status}`;
    const erreur = new Error(donnees.message || parDefaut);
    erreur.status = reponse.status;
    erreur.donnees = donnees; // ex. 409 : le dossier tel qu'il est maintenant en base
    throw erreur;
  }
  return donnees;
}

export const connexion = (badge_number, password, se_souvenir = false) =>
  requete('/api/auth/login', { method: 'POST', body: { badge_number, password, se_souvenir } });

export const deconnexion = () => requete('/api/auth/logout', { method: 'POST' });

export const moi = () => requete('/api/auth/me');

export const changerMotDePasse = (old_password, new_password) =>
  requete('/api/auth/change-password', { method: 'POST', body: { old_password, new_password } });

export const envoyerPhoto = (fichier) => requete('/api/auth/avatar', { method: 'PUT', body: fichier });

export const supprimerPhoto = () => requete('/api/auth/avatar', { method: 'DELETE' });

// Registre et alertes (le cookie de session suffit à s'authentifier)
const qs = (params) => new URLSearchParams(
  Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
).toString();

export const listerCriminels = (params = {}) => requete(`/api/criminals?${qs(params)}`);

export const lireCriminel = (id) => requete(`/api/criminals/${id}`);

export const creerCriminel = (dossier) => requete('/api/criminals', { method: 'POST', body: dossier });

// version : celle du dossier affiché ; le serveur répond 409 si quelqu'un l'a modifié entre-temps
export const changerStatut = (id, status, version) =>
  requete(`/api/criminals/${id}/status`, { method: 'PATCH', body: { status, version } });

export const retirerCriminel = (id) => requete(`/api/criminals/${id}`, { method: 'DELETE' });

export const listerAlertes = (params = {}) => requete(`/api/alerts?${qs(params)}`);
