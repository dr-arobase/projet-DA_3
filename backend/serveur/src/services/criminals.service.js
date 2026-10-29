import * as criminalModel from '../models/criminal.model.js';
import * as auditLogModel from '../models/auditLog.model.js';
import { emitEvent } from '../sockets/index.js';
import { geocodeOrNull } from './geocoding.service.js';

// Statuts autorisés (alignés sur le type criminal_status du schéma SQL)
export const VALID_STATUSES = ['recherche', 'capture', 'libere'];

const httpError = (statusCode, message, extra = {}) =>
  Object.assign(new Error(message), { statusCode, ...extra });

const notFound = () => httpError(404, 'Dossier non trouvé');

export const MAX_ADDRESS = 255; // criminal.last_known_address VARCHAR(255)

// Adresse facultative : texte nettoyé (null si vide) et sa position. Une adresse introuvable,
// ou un service de localisation en panne, n'empêche pas d'enregistrer : la position reste vide.
async function locate(address) {
  if (address !== undefined && address !== null && typeof address !== 'string') {
    throw httpError(400, "L'adresse doit être un texte");
  }
  const texte = address?.trim() || null;
  if (texte && texte.length > MAX_ADDRESS) {
    throw httpError(400, `L'adresse dépasse ${MAX_ADDRESS} caractères`);
  }
  const position = texte ? await geocodeOrNull(texte) : null;
  return { last_known_address: texte, latitude: position?.latitude ?? null, longitude: position?.longitude ?? null };
}

// Vrai si une adresse a été donnée mais n'a pas pu être placée sur la carte
const notLocated = (c) => Boolean(c.last_known_address) && c.latitude === null;

const checkStatus = (status) => {
  if (!VALID_STATUSES.includes(status)) {
    throw httpError(400, `Statut invalide. Les statuts autorisés sont : ${VALID_STATUSES.join(', ')}`);
  }
};

export const MAX_NAME = 100; // first_name, last_name, nationality : VARCHAR(100)
export const INITIAL_STATUS = 'recherche';

// Texte facultatif : null si absent ou vide, 400 si ce n'est pas du texte ou s'il est trop long
function optionalText(value, label, max) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw httpError(400, `Le champ ${label} doit être un texte`);
  const texte = value.trim();
  if (max && texte.length > max) throw httpError(400, `Le champ ${label} dépasse ${max} caractères`);
  return texte || null;
}

function requiredText(value, label, max) {
  const texte = optionalText(value, label, max);
  if (!texte) throw httpError(400, 'Le prénom et le nom sont obligatoires');
  return texte;
}

// Date AAAA-MM-JJ qui existe vraiment (pas de 31 février) et qui n'est pas dans le futur
function checkDateOfBirth(value) {
  if (value === undefined || value === null || value === '') return null;
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = match ? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])) : null;
  if (!date || date.toISOString().slice(0, 10) !== value) {
    throw httpError(400, 'La date de naissance est invalide (format AAAA-MM-JJ)');
  }
  if (value > new Date().toISOString().slice(0, 10)) {
    throw httpError(400, 'La date de naissance ne peut pas être dans le futur');
  }
  return value;
}

// Champs communs à la création et à la modification d'un dossier, nettoyés et vérifiés
function checkCriminalFields(data) {
  // Pas encore d'envoi de photo : on refuse une adresse d'image fournie à la main
  if (data.photo_url !== undefined && data.photo_url !== null && data.photo_url !== '') {
    throw httpError(400, "Le champ photo_url n'est pas encore accepté : l'envoi de photo n'existe pas");
  }
  return {
    first_name: requiredText(data.first_name, 'prénom', MAX_NAME),
    last_name: requiredText(data.last_name, 'nom', MAX_NAME),
    nationality: optionalText(data.nationality, 'nationalité', MAX_NAME),
    date_of_birth: checkDateOfBirth(data.date_of_birth),
    description: optionalText(data.description, 'description'),
    crimes: optionalText(data.crimes, 'crimes'),
  };
}

// La version (verrouillage optimiste) est un entier positif : 1, 2, 3...
function checkVersion(version) {
  if (version === undefined || version === null || version === '') {
    throw httpError(400, 'Le champ version est obligatoire');
  }
  const isNumeric = typeof version === 'number' || (typeof version === 'string' && /^\d+$/.test(version));
  const n = Number(version);
  if (!isNumeric || !Number.isInteger(n) || n < 1) {
    throw httpError(400, 'Le champ version doit être un nombre entier positif');
  }
  return n;
}

export const getAllCriminals = async ({ page = 1, limit = 10, status, search } = {}) => {
  if (status) checkStatus(status);
  const offset = (page - 1) * limit;
  search = search?.trim() || undefined;

  const [data, total] = await Promise.all([
    criminalModel.findAll({ limit, offset, status, search }),
    criminalModel.countAll({ status, search })
  ]);

  return { page, limit, total, totalPages: Math.ceil(total / limit), data };
};

export const getCriminalById = async (id) => {
  const criminal = await criminalModel.findById(id);
  if (!criminal) throw notFound();
  return criminal;
};

export const createCriminal = async (data, userId) => {
  const fields = checkCriminalFields(data);
  // Un nouveau dossier commence toujours au statut « recherche »
  if (data.status !== undefined && data.status !== null && data.status !== '' && data.status !== INITIAL_STATUS) {
    checkStatus(data.status);
    throw httpError(400, `Un nouveau dossier commence toujours au statut « ${INITIAL_STATUS} »`);
  }

  const address = await locate(data.last_known_address);
  const created = await criminalModel.create({
    ...fields, ...address, status: INITIAL_STATUS, photo_url: null, added_by: userId
  });
  const criminal = await criminalModel.findById(created.id);

  emitEvent('criminal:added', criminal);
  return { criminal, addressNotLocated: notLocated(criminal) };
};

// Changer la dernière adresse connue (tout agent : un policier peut l'apprendre sur le terrain)
export const updateCriminalAddress = async (id, address, userId) => {
  const located = await locate(address);
  const updated = await criminalModel.setAddress(id, { ...located, updated_by: userId });
  if (!updated) throw notFound();

  const criminal = await criminalModel.findById(id);
  emitEvent('criminal:updated', criminal);
  return { criminal, addressNotLocated: notLocated(criminal) };
};

export const updateCriminal = async (id, data, userId) => {
  const fields = checkCriminalFields(data);

  const updated = await criminalModel.update(id, { ...fields, photo_url: null, updated_by: userId });
  if (!updated) throw notFound();

  const criminal = await criminalModel.findById(id);
  emitEvent('criminal:updated', criminal);
  return criminal;
};

// Verrouillage optimiste : le client renvoie la version qu'il a affichée.
// Si quelqu'un a modifié le dossier entre-temps, on répond 409 avec l'état courant.
export const updateCriminalStatus = async (id, status, version, userId) => {
  checkStatus(status);
  const expectedVersion = checkVersion(version);

  const updated = await criminalModel.updateStatus(id, status, expectedVersion, userId);
  if (!updated) {
    const current = await criminalModel.findById(id);
    if (!current) throw notFound();
    throw httpError(409, 'Conflit de version : ce dossier a été modifié entre-temps', { criminal: current });
  }

  const criminal = await criminalModel.findById(id);
  emitEvent('criminal:updated', criminal);
  return criminal;
};

export const deleteCriminal = async (id, user) => {
  const removed = await criminalModel.remove(id);
  if (!removed) throw notFound();

  await auditLogModel.record({
    actor_id: user.id,
    action: 'CRIMINAL_REMOVED',
    target_type: 'criminal',
    target_id: removed.id,
    details: { removed_by: user.badge_number }
  });

  emitEvent('criminal:removed', { id: removed.id });
  return removed;
};