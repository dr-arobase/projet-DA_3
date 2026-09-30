import { pool } from '../config/db.js';

const SELECT_WITH_NAME = `
  SELECT
    a.id, a.action, a.target_type, a.target_id, a.details, a.created_at,
    (u.first_name || ' ' || u.last_name) AS actor
  FROM audit_log a
  LEFT JOIN app_user u ON a.actor_id = u.id
`;

// Enregistrer une action dans le journal d'audit
export const record = async ({ actor_id, action, target_type, target_id, details }) => {
  const query = `
    INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
  `;
  const values = [actor_id, action, target_type, target_id, details ? JSON.stringify(details) : null];
  const result = await pool.query(query, values);
  return result.rows[0];
};

// Lister le journal, du plus récent au plus ancien
export const findAll = async ({ limit = 20, offset = 0 } = {}) => {
  const query = `${SELECT_WITH_NAME} ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`;
  const result = await pool.query(query, [limit, offset]);
  return result.rows;
};

export const countAll = async () => {
  const result = await pool.query('SELECT COUNT(*) FROM audit_log');
  return parseInt(result.rows[0].count, 10);
};