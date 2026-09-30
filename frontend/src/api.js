// Appel générique vers le backend. La session est un cookie httpOnly posé par le serveur :
// le navigateur l'envoie tout seul (même origine grâce au proxy Vite), on ne manipule aucun jeton.
export async function requete(chemin, { method = 'GET', body } = {}) {
  let reponse;
  try {
    reponse = await fetch(chemin, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
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
    throw erreur;
  }
  return donnees;
}

export const connexion = (badge_number, password) =>
  requete('/auth/login', { method: 'POST', body: { badge_number, password } });

export const deconnexion = () => requete('/auth/logout', { method: 'POST' });

export const moi = () => requete('/auth/me');
