import { pool } from '../config/db.js';

const SELECT_WITH_NAME = `
  SELECT
    s.id, s.criminal_id, s.location, s.notes, s.reported_at,
    (u.first_name || ' ' || u.last_name) AS reported_by
  FROM sighting s
  LEFT JOIN app_user u ON s.reported_by = u.id
`;

// Historique des signalements pour un dossier donné
export const findByCriminal = async (criminal_id) => {
  const query = `${SELECT_WITH_NAME} WHERE s.criminal_id = $1 ORDER BY s.reported_at DESC`;
  const result = await pool.query(query, [criminal_id]);
  return result.rows;
};

// Un signalement par son id
export const findById = async (id) => {
  const query = `${SELECT_WITH_NAME} WHERE s.id = $1`;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

// Créer un signalement
export const create = async ({ criminal_id, reported_by, location, notes }) => {
  const query = `
    INSERT INTO sighting (criminal_id, reported_by, location, notes)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `;
  const result = await pool.query(query, [criminal_id, reported_by, location, notes]);
  return result.rows[0];
};