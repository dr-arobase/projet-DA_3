import { pool } from '../config/db.js';

export const findAll = async () => {
  const result = await pool.query(
    'SELECT * FROM criminal ORDER BY added_at DESC'
  );
  return result.rows;
};

export const findById = async (id) => {
  const result = await pool.query(
    'SELECT * FROM criminal WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
};

export const create = async ({ first_name, last_name, description, status, added_by }) => {
  const query = `
    INSERT INTO criminal (first_name, last_name, description, status, added_by)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const values = [first_name, last_name, description, status || 'WANTED', added_by];
  const result = await pool.query(query, values);
  return result.rows[0];
};

export const update = async (id, { first_name, last_name, description, status }) => {
  const query = `
    UPDATE criminal
    SET first_name = $1, last_name = $2, description = $3, status = $4, updated_at = CURRENT_TIMESTAMP
    WHERE id = $5
    RETURNING *
  `;
  const result = await pool.query(query, [first_name, last_name, description, status, id]);
  return result.rows[0] || null;
};

export const updateStatus = async (id, status) => {
  const query = `
    UPDATE criminal
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;
  const result = await pool.query(query, [status, id]);
  return result.rows[0] || null;
};