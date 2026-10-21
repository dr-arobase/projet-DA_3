import * as alertModel from '../models/alert.model.js';
import * as auditLogModel from '../models/auditLog.model.js';
import * as criminalModel from '../models/criminal.model.js';
import { emitEvent } from '../sockets/index.js';
import { readPagination } from '../utils/pagination.js';

const VALID_SEVERITIES = ['info', 'urgent'];
const MESSAGE_MAX_LENGTH = 500; // alert.message est un VARCHAR(500)

// POST /api/alerts : diffuser une alerte
export const createAlert = async (req, res) => {
  const { severity, criminal_id } = req.body ?? {};

  // Le message est obligatoire une fois les espaces retirés : "   " est refusé
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message) {
    return res.status(400).json({ message: 'Le champ message est obligatoire' });
  }
  if (message.length > MESSAGE_MAX_LENGTH) {
    return res.status(400).json({ message: `Le message ne doit pas dépasser ${MESSAGE_MAX_LENGTH} caractères` });
  }

  const finalSeverity = severity ?? 'info';
  if (!VALID_SEVERITIES.includes(finalSeverity)) {
    return res.status(400).json({ message: `Sévérité invalide. Valeurs autorisées : ${VALID_SEVERITIES.join(', ')}` });
  }

  // Le dossier lié est facultatif ; s'il est fourni, il doit être un entier positif
  const hasCriminal = criminal_id !== undefined && criminal_id !== null && criminal_id !== '';
  const isIdLike = typeof criminal_id === 'number' || (typeof criminal_id === 'string' && /^\d+$/.test(criminal_id));
  const criminalId = hasCriminal ? Number(criminal_id) : null;
  if (hasCriminal && (!isIdLike || !Number.isInteger(criminalId) || criminalId < 1)) {
    return res.status(400).json({ message: 'Le champ criminal_id doit être un identifiant numérique' });
  }

  try {
    if (hasCriminal && !(await criminalModel.findById(criminalId))) {
      return res.status(404).json({ message: 'Dossier introuvable' });
    }

    const issued_by = req.user.id;
    const created = await alertModel.create({ issued_by, criminal_id: criminalId, message, severity: finalSeverity });
    const alert = await alertModel.findById(created.id);

    await auditLogModel.record({
      actor_id: issued_by,
      action: 'ALERT_ISSUED',
      target_type: 'alert',
      target_id: alert.id,
      details: { severity: finalSeverity, criminal_id: criminalId }
    });

    // issued_by_id : l'émetteur ne reçoit pas sa propre notification (le nom seul ne suffit pas)
    emitEvent('alert:broadcast', { ...alert, issued_by_id: issued_by });

    return res.status(201).json({ message: 'Alerte diffusée avec succès', alert });
  } catch (error) {
    console.error('Erreur lors de la diffusion de l\'alerte:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// GET /api/alerts
export const getAlerts = async (req, res) => {
  try {
        const { page, limit, offset } = readPagination(req.query, 20);

    const alerts = await alertModel.findAll({ limit, offset });
    return res.json({ page, limit, data: alerts });
  } catch (error) {
    console.error('Erreur lors de la récupération des alertes:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};