import { pool } from '../config/db.js';

const SELECT_WITH_NAME = `
  SELECT
    s.id, s.criminal_id, s.location, s.notes, s.latitude, s.longitude, s.reported_at,
    (u.first_name || ' ' || u.last_name) AS reported_by,
    (c.first_name || ' ' || c.last_name) AS criminal_name,
    c.status AS criminal_status
  FROM sighting s
  LEFT JOIN app_user u ON s.reported_by = u.id
  LEFT JOIN criminal c ON s.criminal_id = c.id
`;

// Historique des signalements pour un dossier donné
export const findByCriminal = async (criminal_id) => {
  const query = `${SELECT_WITH_NAME} WHERE s.criminal_id = $1 ORDER BY s.reported_at DESC`;
  const result = await pool.query(query, [criminal_id]);
  return result.rows;
};

// Les signalements les plus récents, tous dossiers confondus (carte)
export const findRecent = async ({ limit = 200 } = {}) => {
  const query = `${SELECT_WITH_NAME} ORDER BY s.reported_at DESC LIMIT $1`;
  const result = await pool.query(query, [limit]);
  return result.rows;
};

// Un signalement par son id
export const findById = async (id) => {
  const query = `${SELECT_WITH_NAME} WHERE s.id = $1`;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

// Créer un signalement (latitude et longitude facultatives)
export const create = async ({ criminal_id, reported_by, location, notes, latitude = null, longitude = null }) => {
  const query = `
    INSERT INTO sighting (criminal_id, reported_by, location, notes, latitude, longitude)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `;
  const result = await pool.query(query, [criminal_id, reported_by, location, notes, latitude, longitude]);
  return result.rows[0];
};
