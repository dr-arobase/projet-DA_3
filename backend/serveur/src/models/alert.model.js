import { pool } from '../config/db.js';

const SELECT_WITH_NAME = `
  SELECT
    a.id, a.criminal_id, a.message, a.severity, a.created_at,
    (u.first_name || ' ' || u.last_name) AS issued_by,
    (c.first_name || ' ' || c.last_name) AS criminal_name
  FROM alert a
  LEFT JOIN app_user u ON a.issued_by = u.id
  LEFT JOIN criminal c ON a.criminal_id = c.id
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
export const findAll = async ({ limit = 20, offset = 0, severity, since } = {}) => {
  const filters = [];
  const values = [];
  if (severity) {
    values.push(severity);
    filters.push(`a.severity = $${values.length}`);
  }
  if (since) {
    values.push(since);
    filters.push(`a.created_at >= $${values.length}`);
  }
  const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
  values.push(limit, offset);
  const query = `${SELECT_WITH_NAME}${where} ORDER BY a.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`;
  const result = await pool.query(query, values);
  return result.rows;
};

export const countAll = async ({ severity, since } = {}) => {
  const filters = [];
  const values = [];
  if (severity) {
    values.push(severity);
    filters.push(`severity = $${values.length}`);
  }
  if (since) {
    values.push(since);
    filters.push(`created_at >= $${values.length}`);
  }
  const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
  const result = await pool.query(`SELECT COUNT(*) FROM alert${where}`, values);
  return Number(result.rows[0].count);
};