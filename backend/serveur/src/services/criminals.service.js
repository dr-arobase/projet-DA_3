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
  if (!data.first_name || !data.last_name) {
    throw httpError(400, 'Le prénom et le nom sont obligatoires');
  }
  if (data.status) checkStatus(data.status);

  const address = await locate(data.last_known_address);
  const created = await criminalModel.create({ ...data, ...address, added_by: userId });
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
  if (!data.first_name || !data.last_name) {
    throw httpError(400, 'Le prénom et le nom sont obligatoires');
  }

  const updated = await criminalModel.update(id, { ...data, updated_by: userId });
  if (!updated) throw notFound();

  const criminal = await criminalModel.findById(id);
  emitEvent('criminal:updated', criminal);
  return criminal;
};

// Verrouillage optimiste : le client renvoie la version qu'il a affichée.
// Si quelqu'un a modifié le dossier entre-temps, on répond 409 avec l'état courant.
export const updateCriminalStatus = async (id, status, version, userId) => {
  checkStatus(status);
  if (version === undefined || version === null) {
    throw httpError(400, 'Le champ version est obligatoire');
  }

  const updated = await criminalModel.updateStatus(id, status, version, userId);
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
