import { pool } from '../config/db.js';

const PUBLIC_FIELDS = 'id, first_name, last_name, badge_number, email, role, grade, is_active, created_at';

// Lister tous les comptes (sans le mot de passe)
export const findAll = async () => {
  const result = await pool.query(`SELECT ${PUBLIC_FIELDS} FROM app_user ORDER BY last_name, first_name`);
  return result.rows;
};

// Récupérer un compte par son id (sans le mot de passe)
export const findById = async (id) => {
  const result = await pool.query(`SELECT ${PUBLIC_FIELDS} FROM app_user WHERE id = $1`, [id]);
  return result.rows[0] || null;
};

// Récupérer un compte par matricule, AVEC le password_hash (utilisé pour le login et pour vérifier les doublons)
export const findByBadge = async (badge_number) => {
  const result = await pool.query('SELECT * FROM app_user WHERE badge_number = $1', [badge_number]);
  return result.rows[0] || null;
};

// Créer un compte policier
export const create = async ({ first_name, last_name, badge_number, email, password_hash, role, grade }) => {
  const query = `
    INSERT INTO app_user (first_name, last_name, badge_number, email, password_hash, role, grade)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING ${PUBLIC_FIELDS}
  `;
  const values = [first_name, last_name, badge_number, email, password_hash, role, grade];
  const result = await pool.query(query, values);
  return result.rows[0];
};

// Désactiver ou réactiver un compte
export const setActive = async (id, is_active) => {
  const result = await pool.query(
    `UPDATE app_user SET is_active = $1 WHERE id = $2 RETURNING ${PUBLIC_FIELDS}`,
    [is_active, id]
  );
  return result.rows[0] || null;
};

// Promouvoir : changer le rôle et le grade
export const promote = async (id, { role, grade }) => {
  const result = await pool.query(
    `UPDATE app_user SET role = $1, grade = $2 WHERE id = $3 RETURNING ${PUBLIC_FIELDS}`,
    [role, grade, id]
  );
  return result.rows[0] || null;
};