import { pool } from '../config/db.js';

// issued_by_id : l'auteur, qui peut modifier ou retirer sa diffusion (#220).
// edited_* : « modifié le … par … »; archived_* : diffusion retirée (archivée, pas supprimée).
const SELECT_WITH_NAME = `
  SELECT
    a.id, a.criminal_id, a.message, a.severity, a.created_at,
    a.issued_by AS issued_by_id,
    (u.first_name || ' ' || u.last_name) AS issued_by,
    (c.first_name || ' ' || c.last_name) AS criminal_name,
    a.edited_at,
    (e.first_name || ' ' || e.last_name) AS edited_by,
    a.archived_at,
    (r.first_name || ' ' || r.last_name) AS archived_by
  FROM alert a
  LEFT JOIN app_user u ON a.issued_by = u.id
  LEFT JOIN criminal c ON a.criminal_id = c.id
  LEFT JOIN app_user e ON a.edited_by = e.id
  LEFT JOIN app_user r ON a.archived_by = r.id
`;

// Créer une alerte
export const create = async ({ issued_by, criminal_id, message, severity }) => {
  const query = `
    INSERT INTO alert (issued_by, criminal_id, message, severity)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `;
  const values = [issued_by, criminal_id || null, message, severity];
  const result = await pool.query(query, values);
  return result.rows[0];
};

// Une alerte par son id
export const findById = async (id) => {
  const query = `${SELECT_WITH_NAME} WHERE a.id = $1`;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

// Filtres communs à la liste et au compte. Par défaut, seules les diffusions en cours;
// archived = true : seulement les diffusions retirées (pour les Archives, #220).
function where({ severity, since, archived = false }, prefix) {
  const filters = [`${prefix}archived_at IS ${archived ? 'NOT ' : ''}NULL`];
  const values = [];
  if (severity) {
    values.push(severity);
    filters.push(`${prefix}severity = $${values.length}`);
  }
  if (since) {
    values.push(since);
    filters.push(`${prefix}created_at >= $${values.length}`);
  }
  return { clause: ` WHERE ${filters.join(' AND ')}`, values };
}

// Lister les alertes, les plus récentes en premier (les archives : les dernières retirées en premier)
export const findAll = async ({ limit = 20, offset = 0, severity, since, archived = false } = {}) => {
  const { clause, values } = where({ severity, since, archived }, 'a.');
  values.push(limit, offset);
  const order = archived ? 'a.archived_at DESC' : 'a.created_at DESC';
  const query = `${SELECT_WITH_NAME}${clause} ORDER BY ${order} LIMIT $${values.length - 1} OFFSET $${values.length}`;
  const result = await pool.query(query, values);
  return result.rows;
};

export const countAll = async ({ severity, since, archived = false } = {}) => {
  const { clause, values } = where({ severity, since, archived }, '');
  const result = await pool.query(`SELECT COUNT(*) FROM alert${clause}`, values);
  return Number(result.rows[0].count);
};

// Modifier le texte d'une diffusion en cours. Rien n'est modifié si elle a été retirée entre-temps.
export const updateMessage = async (id, { message, edited_by }) => {
  const result = await pool.query(
    `UPDATE alert SET message = $1, edited_at = now(), edited_by = $2
     WHERE id = $3 AND archived_at IS NULL RETURNING id`,
    [message, edited_by, id]
  );
  return result.rows[0] || null;
};

// Retirer = archiver : la ligne reste, elle quitte seulement les listes
export const archive = async (id, archivedBy) => {
  const result = await pool.query(
    `UPDATE alert SET archived_at = now(), archived_by = $1
     WHERE id = $2 AND archived_at IS NULL RETURNING id`,
    [archivedBy, id]
  );
  return result.rows[0] || null;
};

// Remettre une diffusion retirée dans les listes
export const restore = async (id) => {
  const result = await pool.query(
    `UPDATE alert SET archived_at = NULL, archived_by = NULL
     WHERE id = $1 AND archived_at IS NOT NULL RETURNING id`,
    [id]
  );
  return result.rows[0] || null;
};
