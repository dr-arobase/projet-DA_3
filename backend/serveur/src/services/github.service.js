import { GitHub, generateState } from 'arctic';

// Connexion GitHub (OAuth 2) par la bibliothèque arctic : elle construit l'adresse
// d'autorisation et échange le code contre un jeton d'accès. Le secret du client
// reste ici, côté serveur; le navigateur ne voit passer que le code et le state.

// Adresse de retour par défaut : celle de `docker compose up` (voir README)
const DEFAULT_CALLBACK_URL = 'http://localhost:8080/api/auth/github/callback';

export const isConfigured = () =>
  Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);

function client() {
  return new GitHub(
    process.env.GITHUB_CLIENT_ID,
    process.env.GITHUB_CLIENT_SECRET,
    process.env.GITHUB_CALLBACK_URL || DEFAULT_CALLBACK_URL
  );
}

// Adresse GitHub où envoyer le navigateur, et le state aléatoire qui protège le retour
// contre la falsification (CSRF). Aucune portée demandée : le profil public suffit.
export function authorizationUrl() {
  const state = generateState();
  const url = client().createAuthorizationURL(state, []);
  return { state, url: url.toString() };
}

// Échange le code reçu au retour contre un jeton, puis lit le profil GitHub
export async function fetchProfile(code) {
  const tokens = await client().validateAuthorizationCode(code);
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokens.accessToken()}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'CrimeTracker',
    },
  });
  if (!response.ok) {
    throw new Error('GITHUB_PROFILE');
  }
  const { id, login, name, email } = await response.json();
  return { id, login, name, email };
}
