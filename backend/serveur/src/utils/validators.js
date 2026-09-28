/**
 * Validation des entrées côté serveur. Chaque fonction retourne
 * { value, errors } : `errors` associe un champ à un message lisible et est
 * vide quand l'entrée est valide ; `value` contient les données nettoyées.
 */

export const CRIMINAL_STATUSES = ['recherche', 'capture', 'libere'];

const MAX_PAGE_SIZE = 50;

function text(input) {
  return typeof input === 'string' ? input.trim() : '';
}

/** Un entier strictement positif, ou null. */
export function parsePositiveInt(input) {
  const s = String(input ?? '');
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

function isHttpUrl(s) {
  try {
    const url = new URL(s);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateLogin(body = {}) {
  const value = { badge_number: text(body.badge_number), password: typeof body.password === 'string' ? body.password : '' };
  const errors = {};
  if (!value.badge_number) errors.badge_number = 'Le matricule est requis.';
  if (!value.password) errors.password = 'Le mot de passe est requis.';
  return { value, errors };
}

export function validateCriminal(body = {}) {
  const value = {
    first_name: text(body.first_name),
    last_name: text(body.last_name),
    date_of_birth: text(body.date_of_birth) || null,
    nationality: text(body.nationality) || null,
    photo_url: text(body.photo_url) || null,
    description: text(body.description) || null,
    crimes: text(body.crimes),
  };
  const errors = {};

  if (!value.first_name) errors.first_name = 'Le prénom est requis.';
  else if (value.first_name.length > 100) errors.first_name = 'Le prénom dépasse 100 caractères.';

  if (!value.last_name) errors.last_name = 'Le nom est requis.';
  else if (value.last_name.length > 100) errors.last_name = 'Le nom dépasse 100 caractères.';

  if (!value.crimes) errors.crimes = 'Au moins un crime reproché est requis.';

  if (value.date_of_birth) {
    if (!isValidDate(value.date_of_birth)) errors.date_of_birth = 'La date de naissance doit être au format AAAA-MM-JJ.';
    else if (new Date(value.date_of_birth) > new Date()) errors.date_of_birth = 'La date de naissance ne peut pas être dans le futur.';
  }

  if (value.nationality && value.nationality.length > 100) errors.nationality = 'La nationalité dépasse 100 caractères.';

  if (value.photo_url && (value.photo_url.length > 500 || !isHttpUrl(value.photo_url))) {
    errors.photo_url = 'La photo doit être une adresse web (http ou https) de 500 caractères au plus.';
  }

  return { value, errors };
}

export function validateStatusChange(body = {}) {
  const value = { status: text(body.status), version: parsePositiveInt(body.version) };
  const errors = {};
  if (!CRIMINAL_STATUSES.includes(value.status)) {
    errors.status = `Le statut doit être l'un de : ${CRIMINAL_STATUSES.join(', ')}.`;
  }
  if (value.version === null) errors.version = 'La version du dossier est requise (entier positif).';
  return { value, errors };
}

export function validateListQuery(query = {}) {
  const value = {
    page: parsePositiveInt(query.page) ?? 1,
    limit: Math.min(parsePositiveInt(query.limit) ?? 10, MAX_PAGE_SIZE),
    search: text(query.q).slice(0, 100),
    status: text(query.status),
  };
  const errors = {};
  if (value.status && !CRIMINAL_STATUSES.includes(value.status)) {
    errors.status = `Le statut doit être l'un de : ${CRIMINAL_STATUSES.join(', ')}.`;
  }
  return { value, errors };
}
