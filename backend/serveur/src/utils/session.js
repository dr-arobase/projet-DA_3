// Session par cookie httpOnly : le navigateur renvoie le jeton tout seul et le
// JavaScript de la page ne peut pas le lire (protection contre le vol par XSS).
export const COOKIE_NAME = 'crimetracker_session';

const HUIT_HEURES = 8 * 60 * 60 * 1000; // même durée que le JWT

// seSouvenir = false : cookie de session, effacé à la fermeture du navigateur
export const cookieOptions = (seSouvenir = false) => ({
  httpOnly: true,
  sameSite: 'lax', // le cookie n'est pas envoyé par les requêtes POST venant d'un autre site
  // true seulement derrière HTTPS : sinon le navigateur refuserait le cookie
  secure: process.env.COOKIE_SECURE === 'true',
  path: '/',
  ...(seSouvenir ? { maxAge: HUIT_HEURES } : {}),
});

// Lit une valeur dans l'en-tête Cookie (« a=1; b=2 »), sans dépendance externe
export function readCookie(cookieHeader, name = COOKIE_NAME) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return null;
}

// Jeton de la requête : en-tête « Authorization: Bearer … » (Swagger, scripts)
// ou, à défaut, cookie de session (navigateur)
export function tokenFrom(headers = {}) {
  const [scheme, token] = (headers.authorization || '').split(' ');
  if (scheme === 'Bearer' && token) return token;
  return readCookie(headers.cookie);
}
