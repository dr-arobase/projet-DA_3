import * as criminalModel from '../models/criminal.model.js';
import * as auditLogModel from '../models/auditLog.model.js';
import { emitEvent } from '../sockets/index.js';

// Statuts autorisés (alignés sur le type criminal_status du schéma SQL)
export const VALID_STATUSES = ['recherche', 'capture', 'libere'];

const httpError = (statusCode, message, extra = {}) =>
  Object.assign(new Error(message), { statusCode, ...extra });

const notFound = () => httpError(404, 'Dossier non trouvé');

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

  const created = await criminalModel.create({ ...data, added_by: userId });
  const criminal = await criminalModel.findById(created.id);

  emitEvent('criminal:added', criminal);
  return criminal;
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
