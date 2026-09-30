import { pool } from '../config/db.js';

// Les noms de l'agent qui a créé / modifié le dossier remplacent leurs id
const SELECT_WITH_NAMES = `
  SELECT
    c.id, c.first_name, c.last_name, c.date_of_birth, c.nationality,
    c.photo_url, c.status, c.description, c.crimes, c.version,
    c.added_at, c.updated_at,
    (au.first_name || ' ' || au.last_name) AS added_by,
    (uu.first_name || ' ' || uu.last_name) AS updated_by
  FROM criminal c
  LEFT JOIN app_user au ON c.added_by = au.id
  LEFT JOIN app_user uu ON c.updated_by = uu.id
`;

// Récupérer les criminels avec pagination et filtre optionnel sur le statut
export const findAll = async ({ limit = 10, offset = 0, status } = {}) => {
  let query = SELECT_WITH_NAMES;
  const params = [];

  if (status) {
    query += ' WHERE c.status = $1';
    params.push(status);
  }

  query += ` ORDER BY c.added_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
};

// Compter les criminels (pour le nombre total de pages)
export const countAll = async (status) => {
  let query = 'SELECT COUNT(*) FROM criminal';
  const params = [];

  if (status) {
    query += ' WHERE status = $1';
    params.push(status);
  }

  const result = await pool.query(query, params);
  return parseInt(result.rows[0].count, 10);
};

export const findById = async (id) => {
  const result = await pool.query(`${SELECT_WITH_NAMES} WHERE c.id = $1`, [id]);
  return result.rows[0] || null;
};

export const create = async ({
  first_name, last_name, date_of_birth, nationality,
  description, crimes, status, photo_url, added_by
}) => {
  const query = `
    INSERT INTO criminal
      (first_name, last_name, date_of_birth, nationality, description, crimes, status, photo_url, added_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;
  const values = [
    first_name, last_name, date_of_birth || null, nationality || null,
    description || null, crimes || null, status || 'recherche',
    photo_url || null, added_by
  ];
  const result = await pool.query(query, values);
  return result.rows[0];
};

// Mettre à jour les informations d'un dossier (sans changer le statut)
export const update = async (id, {
  first_name, last_name, date_of_birth, nationality, description, crimes, photo_url, updated_by
}) => {
  const query = `
    UPDATE criminal
    SET first_name = $1,
        last_name = $2,
        date_of_birth = $3,
        nationality = $4,
        description = $5,
        crimes = $6,
        photo_url = COALESCE($7, photo_url),
        updated_by = $8
    WHERE id = $9
    RETURNING *
  `;
  const values = [
    first_name, last_name, date_of_birth || null, nationality || null,
    description || null, crimes || null, photo_url || null, updated_by, id
  ];
  const result = await pool.query(query, values);
  return result.rows[0] || null;
};

// Changer le statut avec verrouillage optimiste : la mise à jour n'a lieu que si
// la version envoyée est encore la version en base (le trigger l'incrémente ensuite).
// Retourne null si le dossier n'existe pas ou si la version ne correspond plus.
export const updateStatus = async (id, status, expectedVersion, updated_by) => {
  const query = `
    UPDATE criminal
    SET status = $1,
        updated_by = $2
    WHERE id = $3 AND version = $4
    RETURNING *
  `;
  const result = await pool.query(query, [status, updated_by, id, expectedVersion]);
  return result.rows[0] || null;
};

export const remove = async (id) => {
  const result = await pool.query('DELETE FROM criminal WHERE id = $1 RETURNING id', [id]);
  return result.rows[0] || null;
};
