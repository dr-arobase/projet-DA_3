import * as alertModel from '../models/alert.model.js';
import * as auditLogModel from '../models/auditLog.model.js';
import * as criminalModel from '../models/criminal.model.js';
import { emitEvent } from '../sockets/index.js';

// Logique métier des alertes. Les erreurs prévues portent un statusCode (400, 404) ;
// le contrôleur les traduit en réponse HTTP, comme pour les dossiers (criminals.service.js).

export const VALID_SEVERITIES = ['info', 'urgent'];
export const MESSAGE_MAX_LENGTH = 500; // alert.message est un VARCHAR(500)

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

// Dossier lié facultatif : null s'il est absent, sinon un entier positif (400 sinon)
function readCriminalId(value) {
  if (value === undefined || value === null || value === '') return null;
  const isIdLike = typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value));
  const id = Number(value);
  if (!isIdLike || !Number.isInteger(id) || id < 1) {
    throw httpError(400, 'Le champ criminal_id doit être un identifiant numérique');
  }
  return id;
}

// Diffuser une alerte : enregistrée, inscrite au journal d'audit, puis envoyée à tous les agents
export const createAlert = async (data = {}, issuedBy) => {
  // Le message est obligatoire une fois les espaces retirés : "   " est refusé
  const message = typeof data.message === 'string' ? data.message.trim() : '';
  if (!message) {
    throw httpError(400, 'Le champ message est obligatoire');
  }
  if (message.length > MESSAGE_MAX_LENGTH) {
    throw httpError(400, `Le message ne doit pas dépasser ${MESSAGE_MAX_LENGTH} caractères`);
  }

  const severity = data.severity ?? 'info';
  if (!VALID_SEVERITIES.includes(severity)) {
    throw httpError(400, `Sévérité invalide. Valeurs autorisées : ${VALID_SEVERITIES.join(', ')}`);
  }

  const criminalId = readCriminalId(data.criminal_id);
  if (criminalId && !(await criminalModel.findById(criminalId))) {
    throw httpError(404, 'Dossier introuvable');
  }

  const created = await alertModel.create({ issued_by: issuedBy, criminal_id: criminalId, message, severity });
  const alert = await alertModel.findById(created.id);

  await auditLogModel.record({
    actor_id: issuedBy,
    action: 'ALERT_ISSUED',
    target_type: 'alert',
    target_id: alert.id,
    details: { severity, criminal_id: criminalId }
  });

  // issued_by_id : l'émetteur ne reçoit pas sa propre notification (le nom seul ne suffit pas)
  emitEvent('alert:broadcast', { ...alert, issued_by_id: issuedBy });
  return alert;
};

// Les alertes les plus récentes en premier
export const listAlerts = ({ limit, offset }) => alertModel.findAll({ limit, offset });