import { pool } from '../config/db.js';

/**
 * Construit la clause WHERE commune à la liste et au compte :
 * recherche par nom (prénom, nom ou « prénom nom ») et filtre par statut.
 */
function buildFilters({ search, status }) {
  const conditions = [];
  const params = [];

  if (search) {
    // Les caractères spéciaux de LIKE sont cherchés tels quels.
    params.push(`%${search.replace(/[\\%_]/g, '\\$&')}%`);
    conditions.push(`(first_name || ' ' || last_name) ILIKE $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

/** Une page de dossiers, du plus récent au plus ancien. */
export async function findAll({ limit, offset, search, status }) {
  const { where, params } = buildFilters({ search, status });
  const { rows } = await pool.query(
    `SELECT id, first_name, last_name, status, photo_url, updated_at
     FROM criminal ${where}
     ORDER BY added_at DESC, id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return rows;
}

/** Le nombre total de dossiers qui respectent les mêmes filtres. */
export async function countAll({ search, status }) {
  const { where, params } = buildFilters({ search, status });
  const { rows } = await pool.query(`SELECT COUNT(*) AS total FROM criminal ${where}`, params);
  return rows[0].total;
}

/** Le dossier complet, avec le nom de ses auteurs, ou null. */
export async function findById(id) {
  const { rows } = await pool.query(
    `SELECT c.*,
            a.first_name || ' ' || a.last_name AS added_by_name,
            u.first_name || ' ' || u.last_name AS updated_by_name
     FROM criminal c
     JOIN app_user a ON a.id = c.added_by
     LEFT JOIN app_user u ON u.id = c.updated_by
     WHERE c.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

/** Les statuts pris par un dossier, du plus récent au plus ancien. */
export async function findStatusHistory(id) {
  const { rows } = await pool.query(
    `SELECT h.status, h.changed_at, u.first_name || ' ' || u.last_name AS changed_by_name
     FROM criminal_status_history h
     JOIN app_user u ON u.id = h.changed_by
     WHERE h.criminal_id = $1
     ORDER BY h.changed_at DESC, h.id DESC`,
    [id]
  );
  return rows;
}

/** Insère un dossier (statut initial : recherche), dans la transaction de `client`. */
export async function create(client, fields, addedBy) {
  const { rows } = await client.query(
    `INSERT INTO criminal (first_name, last_name, date_of_birth, nationality, photo_url, description, crimes, added_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      fields.first_name,
      fields.last_name,
      fields.date_of_birth,
      fields.nationality,
      fields.photo_url,
      fields.description,
      fields.crimes,
      addedBy,
    ]
  );
  return rows[0];
}

/**
 * Change le statut seulement si `version` est toujours la version en base
 * (verrouillage optimiste). Retourne le dossier modifié, ou null si le dossier
 * n'existe pas ou si sa version a changé entre-temps.
 */
export async function updateStatus(client, id, { status, version }, updatedBy) {
  const { rows } = await client.query(
    `UPDATE criminal SET status = $1, updated_by = $2
     WHERE id = $3 AND version = $4
     RETURNING *`,
    [status, updatedBy, id, version]
  );
  return rows[0] ?? null;
}

/** Ajoute une entrée à l'historique des statuts, dans la transaction de `client`. */
export async function addStatusHistory(client, criminalId, status, changedBy) {
  await client.query(
    'INSERT INTO criminal_status_history (criminal_id, status, changed_by) VALUES ($1, $2, $3)',
    [criminalId, status, changedBy]
  );
}

/** Supprime un dossier ; retourne le dossier supprimé, ou null s'il n'existait pas. */
export async function remove(client, id) {
  const { rows } = await client.query('DELETE FROM criminal WHERE id = $1 RETURNING id, first_name, last_name', [id]);
  return rows[0] ?? null;
}
