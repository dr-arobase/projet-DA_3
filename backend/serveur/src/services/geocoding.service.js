// Conversion d'une adresse en position (géocodage) par Nominatim, le service d'OpenStreetMap,
// la même source que les tuiles de la carte. Appelé par le serveur, jamais par le navigateur :
// la politique d'utilisation de Nominatim exige un User-Agent qui identifie l'application et
// au plus une requête par seconde. Les réponses sont gardées en mémoire pour ne pas redemander.

const NOMINATIM_URL = process.env.GEOCODER_URL || 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'CrimeTracker/1.0 (projet scolaire, Collège de Maisonneuve)';
const DELAI_MIN = 1000; // 1 requête par seconde au plus
const DELAI_MAX_REPONSE = 5000;
const MAX_CACHE = 500;
// File d'attente plafonnée (#91) : sans plafond, un agent qui envoie 300 adresses bloquait
// celles de tout le monde pendant 5 minutes. Au-delà, l'appel est refusé (GEOCODER_BUSY → 429).
export const MAX_EN_ATTENTE_PAR_AGENT = 2;
export const MAX_EN_ATTENTE = 10;

const cache = new Map();
let prochaineRequete = 0;
let enAttente = 0;
const enAttenteParAgent = new Map();

// Attend son tour : les appels simultanés sont espacés d'une seconde
async function attendreSonTour() {
  const maintenant = Date.now();
  const depart = Math.max(maintenant, prochaineRequete);
  prochaineRequete = depart + DELAI_MIN;
  if (depart > maintenant) await new Promise((resolve) => setTimeout(resolve, depart - maintenant));
}

// Renvoie { latitude, longitude, display_name }, ou null si l'adresse est introuvable.
// Lève une erreur GEOCODER_UNAVAILABLE si le service ne répond pas,
// et GEOCODER_BUSY si l'agent (agentId) ou la file entière a déjà trop de demandes en cours.
// Sans agentId (adresse d'un dossier enregistré par le serveur), seul le plafond global compte.
export async function geocode(adresse, agentId) {
  const cle = adresse.trim().toLowerCase();
  if (cache.has(cle)) return cache.get(cle);

  const dejaPourAgent = agentId === undefined ? 0 : (enAttenteParAgent.get(agentId) ?? 0);
  if (dejaPourAgent >= MAX_EN_ATTENTE_PAR_AGENT || enAttente >= MAX_EN_ATTENTE) {
    throw new Error('GEOCODER_BUSY');
  }
  enAttente += 1;
  if (agentId !== undefined) enAttenteParAgent.set(agentId, dejaPourAgent + 1);
  try {
    return await interroger(adresse, cle);
  } finally {
    enAttente -= 1;
    if (agentId !== undefined) {
      const reste = enAttenteParAgent.get(agentId) - 1;
      if (reste > 0) enAttenteParAgent.set(agentId, reste);
      else enAttenteParAgent.delete(agentId);
    }
  }
}

async function interroger(adresse, cle) {
  await attendreSonTour();
  const url = new URL(NOMINATIM_URL);
  url.search = new URLSearchParams({
    q: adresse,
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'ca',
    'accept-language': 'fr',
  }).toString();

  let resultats;
  try {
    const reponse = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(DELAI_MAX_REPONSE),
    });
    if (!reponse.ok) throw new Error(`Nominatim a répondu ${reponse.status}`);
    resultats = await reponse.json();
  } catch (error) {
    throw Object.assign(new Error('GEOCODER_UNAVAILABLE'), { cause: error });
  }

  const premier = resultats[0];
  const position = premier
    ? { latitude: Number(premier.lat), longitude: Number(premier.lon), display_name: premier.display_name }
    : null;

  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(cle, position);
  return position;
}

// Variante qui ne lève jamais : null si introuvable OU si le service est indisponible.
// Pour enregistrer un dossier même quand la carte ne peut pas le placer.
export async function geocodeOrNull(adresse) {
  try {
    return await geocode(adresse);
  } catch {
    return null;
  }
}
