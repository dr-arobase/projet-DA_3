// Appel générique vers le backend. La session est un cookie httpOnly posé par le serveur :
// le navigateur l'envoie tout seul (même origine grâce au proxy Vite), on ne manipule aucun jeton.
// body : un objet (envoyé en JSON) ou un fichier (envoyé tel quel, avec son type MIME).
import { API_URL, urlApi } from './config.js';

export async function requete(chemin, { method = 'GET', body } = {}) {
  const fichier = body instanceof Blob;
  let reponse;
  try {
    reponse = await fetch(urlApi(chemin), {
      method,
      // API sur un autre site (GitHub Pages) : le cookie de session doit l'accompagner
      credentials: API_URL ? 'include' : 'same-origin',
      headers: body ? { 'Content-Type': fichier ? body.type : 'application/json' } : undefined,
      body: body ? (fichier ? body : JSON.stringify(body)) : undefined,
    });
  } catch {
    throw new Error('Serveur injoignable. Vérifiez que le backend est démarré.');
  }

  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    if ((reponse.status === 401 || reponse.status === 403)
      && !chemin.startsWith('/api/auth/login')
      && !chemin.startsWith('/api/auth/github')) {
      window.location.assign('/connexion');
    }
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

// Dernière adresse connue (vide pour l'effacer); le serveur la place sur la carte s'il la trouve
export const changerAdresse = (id, last_known_address) =>
  requete(`/api/criminals/${id}/address`, { method: 'PATCH', body: { last_known_address } });

// Position d'une adresse écrite (géocodage par le serveur) : { latitude, longitude, display_name }
export const localiser = (adresse) => requete(`/api/geocode?${qs({ q: adresse })}`);

export const listerAlertes = (params = {}) => requete(`/api/alerts?${qs(params)}`);

// severity : 'urgent' (alerte) ou 'info' (communiqué) ; réservé aux superviseurs et à la direction
export const diffuserAlerte = (message, severity, criminal_id) =>
  requete('/api/alerts', { method: 'POST', body: { message, severity, criminal_id } });

// Comptes des agents : superviseur ou direction (promouvoir : direction seulement)
export const listerUtilisateurs = () => requete('/api/users');

export const creerUtilisateur = (agent) => requete('/api/users', { method: 'POST', body: agent });

export const desactiverUtilisateur = (id) => requete(`/api/users/${id}/deactivate`, { method: 'PATCH' });

export const reactiverUtilisateur = (id) => requete(`/api/users/${id}/reactivate`, { method: 'PATCH' });

export const promouvoirUtilisateur = (id, role, grade) =>
  requete(`/api/users/${id}/promote`, { method: 'PATCH', body: { role, grade } });

// Signalements terrain (carte) : latitude et longitude facultatives
export const listerSignalementsRecents = (params = {}) => requete(`/api/sightings/recent?${qs(params)}`);

export const signaler = (signalement) => requete('/api/sightings', { method: 'POST', body: signalement });

// Messagerie privée
export const listerContacts = () => requete('/api/messages/contacts');

export const lireConversation = (agentId) => requete(`/api/messages/${agentId}`);

export const envoyerMessage = (recipient_id, body) =>
  requete('/api/messages', { method: 'POST', body: { recipient_id, body } });

// Groupes de la messagerie
export const listerGroupes = () => requete('/api/messages/groups');

export const creerGroupe = (name, member_ids) =>
  requete('/api/messages/groups', { method: 'POST', body: { name, member_ids } });

export const lireGroupe = (groupeId) => requete(`/api/messages/groups/${groupeId}`);

export const envoyerAuGroupe = (groupeId, body) =>
  requete(`/api/messages/groups/${groupeId}/messages`, { method: 'POST', body: { body } });

export const ajouterMembres = (groupeId, member_ids) =>
  requete(`/api/messages/groups/${groupeId}/members`, { method: 'POST', body: { member_ids } });

// Retirer un membre (créateur), ou se retirer soi-même pour quitter le groupe
export const retirerMembre = (groupeId, agentId) =>
  requete(`/api/messages/groups/${groupeId}/members/${agentId}`, { method: 'DELETE' });
