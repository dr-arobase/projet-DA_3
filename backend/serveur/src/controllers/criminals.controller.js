import { withTransaction } from '../config/db.js';
import * as auditLogModel from '../models/auditLog.model.js';
import * as criminalModel from '../models/criminal.model.js';
import {
  parsePositiveInt,
  validateCriminal,
  validateListQuery,
  validateStatusChange,
} from '../utils/validators.js';

const hasErrors = (errors) => Object.keys(errors).length > 0;

const invalidId = (res) => res.status(400).json({ message: 'L\'identifiant du dossier doit être un entier positif.' });
const notFound = (res) => res.status(404).json({ message: 'Aucun dossier ne correspond à cet identifiant.' });

// GET /api/criminals?page=&limit=&q=&status=
export async function list(req, res, next) {
  const { value, errors } = validateListQuery(req.query);
  if (hasErrors(errors)) return res.status(400).json({ message: 'Filtre invalide.', errors });

  try {
    const { page, limit, search, status } = value;
    const [data, total] = await Promise.all([
      criminalModel.findAll({ limit, offset: (page - 1) * limit, search, status }),
      criminalModel.countAll({ search, status }),
    ]);
    return res.json({ page, limit, total, totalPages: Math.ceil(total / limit), data });
  } catch (err) {
    return next(err);
  }
}

// GET /api/criminals/:id
export async function getById(req, res, next) {
  const id = parsePositiveInt(req.params.id);
  if (!id) return invalidId(res);

  try {
    const criminal = await criminalModel.findById(id);
    if (!criminal) return notFound(res);
    const status_history = await criminalModel.findStatusHistory(id);
    return res.json({ ...criminal, status_history });
  } catch (err) {
    return next(err);
  }
}

// POST /api/criminals
export async function create(req, res, next) {
  const { value, errors } = validateCriminal(req.body);
  if (hasErrors(errors)) {
    return res.status(400).json({ message: 'Le dossier contient des champs manquants ou invalides.', errors });
  }

  try {
    const criminal = await withTransaction(async (client) => {
      const created = await criminalModel.create(client, value, req.user.id);
      await criminalModel.addStatusHistory(client, created.id, created.status, req.user.id);
      return created;
    });
    return res.status(201).location(`/api/criminals/${criminal.id}`).json({ message: 'Dossier créé.', criminal });
  } catch (err) {
    return next(err);
  }
}

// PATCH /api/criminals/:id  { status, version }
export async function changeStatus(req, res, next) {
  const id = parsePositiveInt(req.params.id);
  if (!id) return invalidId(res);

  const { value, errors } = validateStatusChange(req.body);
  if (hasErrors(errors)) return res.status(400).json({ message: 'Changement de statut invalide.', errors });

  try {
    const current = await criminalModel.findById(id);
    if (!current) return notFound(res);

    const conflict = () =>
      res.status(409).json({
        message: 'Ce dossier a été modifié par quelqu\'un d\'autre depuis votre lecture. Rechargez-le avant de réessayer.',
        current: { status: current.status, version: current.version },
      });

    if (current.version !== value.version) return conflict();
    if (current.status === value.status) {
      return res.status(400).json({ message: `Le dossier a déjà le statut « ${value.status} ».` });
    }

    const updated = await withTransaction(async (client) => {
      // La condition sur la version protège aussi d'une écriture concurrente entre la lecture et l'écriture.
      const row = await criminalModel.updateStatus(client, id, value, req.user.id);
      if (row) await criminalModel.addStatusHistory(client, id, row.status, req.user.id);
      return row;
    });
    if (!updated) return conflict();

    return res.json({ message: 'Statut mis à jour.', criminal: updated });
  } catch (err) {
    return next(err);
  }
}

// DELETE /api/criminals/:id  (superviseur ou direction)
export async function remove(req, res, next) {
  const id = parsePositiveInt(req.params.id);
  if (!id) return invalidId(res);

  try {
    const removed = await withTransaction(async (client) => {
      const row = await criminalModel.remove(client, id);
      if (row) {
        await auditLogModel.insert(client, {
          actorId: req.user.id,
          action: 'criminal.remove',
          targetType: 'criminal',
          targetId: id,
          details: { first_name: row.first_name, last_name: row.last_name },
        });
      }
      return row;
    });
    if (!removed) return notFound(res);
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
}
