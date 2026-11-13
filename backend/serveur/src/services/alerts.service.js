import * as alertModel from '../models/alert.model.js';
import * as auditLogModel from '../models/auditLog.model.js';
import * as criminalModel from '../models/criminal.model.js';
import { emitEvent } from '../sockets/index.js';
import { estVisible } from '../utils/texte.js';

// Logique métier des alertes. Les erreurs prévues portent un statusCode (400, 403, 404) ;
// le contrôleur les traduit en réponse HTTP, comme pour les dossiers (criminals.service.js).
//
// Deux sortes de diffusions dans la table alert (#202, demande du PO) :
//   - « urgent » = une alerte : tout agent peut la diffuser, policier compris;
//   - « info »   = un communiqué : réservé au superviseur et à la direction (403 pour un policier).

export const VALID_SEVERITIES = ['info', 'urgent'];
const ROLES_COMMUNIQUE = ['superviseur', 'direction'];

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

// Diffuser une alerte ou un communiqué : enregistré, inscrit au journal d'audit, puis envoyé à tous les agents.
// actor = l'agent connecté (req.user) : son id et son rôle.
export const createAlert = async (data = {}, actor) => {
  const issuedBy = actor.id;

  const severity = data.severity ?? 'info';
  if (!VALID_SEVERITIES.includes(severity)) {
    throw httpError(400, `Sévérité invalide. Valeurs autorisées : ${VALID_SEVERITIES.join(', ')}`);
  }
  // Vérifié avant le message : un policier qui n'a pas le droit n'apprend rien de plus
  if (severity === 'info' && !ROLES_COMMUNIQUE.includes(actor.role)) {
    throw httpError(403, 'Accès refusé : un communiqué est réservé au superviseur et à la direction');
  }

  // Le message est obligatoire une fois les espaces retirés; des caractères invisibles
  // seuls (U+200B…) sont refusés aussi, comme pour les messages et les signalements (#94)
  const message = typeof data.message === 'string' ? data.message.trim() : '';
  if (!message || !estVisible(message)) {
    throw httpError(400, 'Le champ message est obligatoire');
  }
  // Pas de limite de caractères (alert.message est un TEXT, #219) : seule la taille d'une requête, 1 Mo, la borne

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

// Les alertes les plus récentes en premier, filtrées au besoin par gravité ou date
export const listAlerts = ({ limit, offset, severity, since }) =>
  alertModel.findAll({ limit, offset, severity, since });

export const countAlerts = ({ severity, since }) => alertModel.countAll({ severity, since });