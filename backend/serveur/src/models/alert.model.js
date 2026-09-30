import { pool } from '../config/db.js';

const SELECT_WITH_NAME = `
  SELECT
    a.id, a.criminal_id, a.message, a.severity, a.created_at,
    (u.first_name || ' ' || u.last_name) AS issued_by
  FROM alert a
  LEFT JOIN app_user u ON a.issued_by = u.id
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

// Lister les alertes, les plus récentes en premier
export const findAll = async ({ limit = 20, offset = 0 } = {}) => {
  const query = `${SELECT_WITH_NAME} ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`;
  const result = await pool.query(query, [limit, offset]);
  return result.rows;
};