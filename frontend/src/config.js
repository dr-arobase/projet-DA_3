// Où se trouve l'application, et où trouver l'API.
//
// Par défaut (Docker, npm run dev) : tout est à la racine du même site, nginx ou le proxy Vite
// relaie /api et /socket.io. Rien n'est à configurer.
//
// Sur GitHub Pages (.github/workflows/pages.yml) : le site est servi sous /projet-DA_3/ et il
// est statique. VITE_API_URL donne l'adresse d'une API hébergée ailleurs; sans elle, la page de
// connexion annonce que le serveur n'est pas en ligne (VITE_SANS_SERVEUR).

export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export const SANS_SERVEUR = import.meta.env.VITE_SANS_SERVEUR === 'true';

// Adresse d'une route de l'API (ex. '/api/auth/me')
export const urlApi = (chemin) => `${API_URL}${chemin}`;

// Adresse d'une page de l'application, pour les liens hors du routeur (ex. bulles de la carte)
export const lienPage = (chemin) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}${chemin}`;
