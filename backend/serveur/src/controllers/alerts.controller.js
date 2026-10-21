import * as alertModel from '../models/alert.model.js';
import * as auditLogModel from '../models/auditLog.model.js';
import { emitEvent } from '../sockets/index.js';
import { readPagination } from '../utils/pagination.js';

const VALID_SEVERITIES = ['info', 'urgent'];

// POST /api/alerts : diffuser une alerte
export const createAlert = async (req, res) => {
  const { message, severity, criminal_id } = req.body;

  if (!message) {
    return res.status(400).json({ message: 'Le champ message est obligatoire' });
  }
  const finalSeverity = severity || 'info';
  if (!VALID_SEVERITIES.includes(finalSeverity)) {
    return res.status(400).json({ message: `Sévérité invalide. Valeurs autorisées : ${VALID_SEVERITIES.join(', ')}` });
  }

  try {
    const issued_by = req.user.id;
    const created = await alertModel.create({ issued_by, criminal_id, message, severity: finalSeverity });
    const alert = await alertModel.findById(created.id);

    await auditLogModel.record({
      actor_id: issued_by,
      action: 'ALERT_ISSUED',
      target_type: 'alert',
      target_id: alert.id,
      details: { severity: finalSeverity, criminal_id: criminal_id || null }
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