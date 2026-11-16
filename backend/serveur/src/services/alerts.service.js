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

// Le message est obligatoire une fois les espaces retirés; des caractères invisibles
// seuls (U+200B…) sont refusés aussi, comme pour les messages et les signalements (#94).
// Pas de limite de caractères (alert.message est un TEXT, #219) : seule la taille d'une requête, 1 Mo, la borne.
function readMessage(value) {
  const message = typeof value === 'string' ? value.trim() : '';
  if (!message || !estVisible(message)) {
    throw httpError(400, 'Le champ message est obligatoire');
  }
  return message;
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

  const message = readMessage(data.message);

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

// Filtres de GET /api/alerts (#84) : une valeur mal formée donne 400, jamais 500.
// Avant, ?severity=critique, ?since=hier ou un filtre répété (?severity=a&severity=b)
// partaient tels quels vers PostgreSQL, qui les refusait : panne serveur (500).
// Un filtre absent ou vide (?severity=) n'est pas appliqué.
export function readFilters({ severity, since, archived } = {}) {
  const filters = {};
  // ?archived=true : les diffusions retirées (Archives, #220); absent ou false : celles en cours
  if (archived !== undefined && archived !== '' && archived !== 'false') {
    if (archived !== 'true') throw httpError(400, 'Filtre archived invalide. Valeurs autorisées : true, false');
    filters.archived = true;
  }
  if (severity !== undefined && severity !== '') {
    if (typeof severity !== 'string' || !VALID_SEVERITIES.includes(severity)) {
      throw httpError(400, `Filtre severity invalide. Valeurs autorisées : ${VALID_SEVERITIES.join(', ')}`);
    }
    filters.severity = severity;
  }
  if (since !== undefined && since !== '') filters.since = readSince(since);
  return filters;
}

// Date ISO 8601 : 2026-11-14, 2026-11-14T08:00, 2026-11-14T08:00:00Z, 2026-11-14T08:00:00.000-05:00…
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

// Le jour existe-t-il ? (JavaScript transforme 2026-02-30 en 2 mars sans rien dire)
const dayExists = (year, month, day) =>
  month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();

function readSince(value) {
  const parts = typeof value === 'string' ? ISO_DATE.exec(value) : null;
  const date = parts ? new Date(value) : null;
  const valid = parts && !Number.isNaN(date.getTime())
    && Number(parts[1]) >= 1 // PostgreSQL n'a pas d'an 0
    && dayExists(Number(parts[1]), Number(parts[2]), Number(parts[3]));
  if (!valid) {
    throw httpError(400, 'Filtre since invalide : date ISO 8601 attendue (ex. 2026-11-14 ou 2026-11-14T08:00:00Z)');
  }
  // Envoyée à PostgreSQL sous une seule forme, sans ambiguïté
  return date.toISOString();
}

// Les alertes les plus récentes en premier, filtrées au besoin par gravité, date ou archivage
export const listAlerts = ({ limit, offset, severity, since, archived }) =>
  alertModel.findAll({ limit, offset, severity, since, archived });

export const countAlerts = ({ severity, since, archived }) => alertModel.countAll({ severity, since, archived });

// ---------------------------------------------------------------------------
// Modifier, retirer et remettre une diffusion (#220, demande du PO)
// Règle : l'auteur de la diffusion, ou la direction. Les autres reçoivent 403.
// Retirer = archiver : la diffusion quitte les listes mais reste en base; on peut la remettre.
// Chaque action est inscrite au journal d'audit et envoyée en direct à tous les agents.
// ---------------------------------------------------------------------------

const peutGerer = (alert, actor) => alert.issued_by_id === actor.id || actor.role === 'direction';

// La diffusion, si elle existe (404) et si l'agent a le droit d'y toucher (403)
async function readOwnAlert(id, actor) {
  const alert = await alertModel.findById(id);
  if (!alert) throw httpError(404, 'Diffusion introuvable');
  if (!peutGerer(alert, actor)) {
    throw httpError(403, 'Accès refusé : seul l\'auteur de la diffusion ou la direction peut la modifier ou la retirer');
  }
  return alert;
}

const journaliser = (actor, action, alert, details) => auditLogModel.record({
  actor_id: actor.id,
  action,
  target_type: 'alert',
  target_id: alert.id,
  details: { severity: alert.severity, ...details },
});

// Modifier le texte. La gravité ne change pas : une alerte reste une alerte, un communiqué un communiqué.
export const updateAlert = async (id, data = {}, actor) => {
  const current = await readOwnAlert(id, actor);
  if (current.archived_at) throw httpError(409, 'Cette diffusion est retirée : remettez-la avant de la modifier');
  const message = readMessage(data.message);
  if (message === current.message) return current; // rien n'a changé : pas de mention « modifié »

  // Retirée entre la lecture et l'écriture (par un autre agent) : rien n'est modifié
  if (!(await alertModel.updateMessage(id, { message, edited_by: actor.id }))) {
    throw httpError(409, 'Cette diffusion vient d\'être retirée : elle n\'a pas été modifiée');
  }
  const alert = await alertModel.findById(id);
  await journaliser(actor, 'ALERT_EDITED', alert, { ancien_message: current.message });
  emitEvent('alert:updated', alert);
  return alert;
};

export const archiveAlert = async (id, actor) => {
  const current = await readOwnAlert(id, actor);
  if (current.archived_at || !(await alertModel.archive(id, actor.id))) {
    throw httpError(409, 'Cette diffusion est déjà retirée');
  }
  const alert = await alertModel.findById(id);
  await journaliser(actor, 'ALERT_ARCHIVED', alert);
  // Les agents la retirent de leurs listes; les Archives l'ajoutent
  emitEvent('alert:archived', alert);
  return alert;
};

export const restoreAlert = async (id, actor) => {
  const current = await readOwnAlert(id, actor);
  if (!current.archived_at || !(await alertModel.restore(id))) {
    throw httpError(409, 'Cette diffusion n\'est pas retirée');
  }
  const alert = await alertModel.findById(id);
  await journaliser(actor, 'ALERT_RESTORED', alert);
  // Elle revient à sa place dans les listes, sans nouvelle notification (ce n'est pas une nouvelle diffusion)
  emitEvent('alert:restored', alert);
  return alert;
};
