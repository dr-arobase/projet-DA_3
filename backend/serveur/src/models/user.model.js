import { pool } from '../config/db.js';

const PUBLIC_COLUMNS = 'id, first_name, last_name, badge_number, role, grade, is_active';

/** Le compte (avec son mot de passe haché) associé à un matricule, ou null. */
export async function findByBadge(badgeNumber) {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLUMNS}, password_hash FROM app_user WHERE badge_number = $1`,
    [badgeNumber]
  );
  return rows[0] ?? null;
}

/** Le compte (sans mot de passe) associé à un identifiant, ou null. */
export async function findById(id) {
  const { rows } = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM app_user WHERE id = $1`, [id]);
  return rows[0] ?? null;
}
