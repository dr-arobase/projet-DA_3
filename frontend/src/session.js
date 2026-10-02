// Mémorise l'utilisateur connecté (le jeton, lui, est dans un cookie httpOnly géré par le serveur).
// « Se souvenir de moi » => localStorage, sinon sessionStorage (effacé à la fermeture du navigateur).
const CLE = 'crimetracker_session';

export function lireSession() {
  try {
    const brut = localStorage.getItem(CLE) ?? sessionStorage.getItem(CLE);
    return brut ? JSON.parse(brut) : null;
  } catch {
    return null;
  }
}

export function enregistrerSession(session, seSouvenir) {
  effacerSession();
  const stockage = seSouvenir ? localStorage : sessionStorage;
  stockage.setItem(CLE, JSON.stringify(session));
}

// Met à jour l'utilisateur mémorisé (ex. nouvelle photo) sans changer de stockage
export function mettreAJourSession(session) {
  if (localStorage.getItem(CLE)) localStorage.setItem(CLE, JSON.stringify(session));
  else if (sessionStorage.getItem(CLE)) sessionStorage.setItem(CLE, JSON.stringify(session));
}

export function effacerSession() {
  localStorage.removeItem(CLE);
  sessionStorage.removeItem(CLE);
}
