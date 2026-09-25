const db = require('../config/db');

// Récupérer tous les criminels avec pagination et filtre statut
const findAll = async ({ limit = 10, offset = 0, status }) => {
  let query = 'SELECT * FROM criminal';
  const params = [];

  if (status) {
    query += ' WHERE status = $1';
    params.push(status);
  }

  query += ` ORDER BY added_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await db.query(query, params);
  return result.rows;
};

// Compter le nombre total de criminels
const countAll = async (status) => {
  let query = 'SELECT COUNT(*) FROM criminal';
  const params = [];

  if (status) {
    query += ' WHERE status = $1';
    params.push(status);
  }

  const result = await db.query(query, params);
  return parseInt(result.rows[0].count, 10);
};

// Récupérer un criminel par son ID
const findById = async (id) => {
  const query = 'SELECT * FROM criminal WHERE id = $1';
  const result = await db.query(query, [id]);
  return result.rows[0] || null;
};

// Créer un nouveau criminel
const create = async ({ first_name, last_name, description, status, photo_url, added_by }) => {
  const query = `
    INSERT INTO criminal (first_name, last_name, description, status, photo_url, added_by)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;
  const values = [
    first_name,
    last_name,
    description,
    status || 'WANTED',
    photo_url || null,
    added_by
  ];

  const result = await db.query(query, values);
  return result.rows[0];
};

// Mettre à jour les informations d'un criminel
const update = async (id, { first_name, last_name, description, status, photo_url }) => {
  const query = `
    UPDATE criminal
    SET first_name = $1,
        last_name = $2,
        description = $3,
        status = $4,
        photo_url = COALESCE($5, photo_url),
        updated_at = NOW()
    WHERE id = $6
    RETURNING *
  `;
  const values = [first_name, last_name, description, status, photo_url, id];

  const result = await db.query(query, values);
  return result.rows[0] || null;
};

// Changer le statut d'un criminel (ex: WANTED, CAPTURED, IN_PRISON, RELEASED, ARCHIVED)
const updateStatus = async (id, status) => {
  const query = `
    UPDATE criminal
    SET status = $1,
        updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `;
  const result = await db.query(query, [status, id]);
  return result.rows[0] || null;
};

module.exports = {
  findAll,
  countAll,
  findById,
  create,
  update,
  updateStatus
};