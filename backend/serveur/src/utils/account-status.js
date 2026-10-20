import { pool } from '../config/db.js';

const inactiveAccountIds = new Set();

export async function loadInactiveAccounts() {
  const result = await pool.query('SELECT id FROM app_user WHERE is_active = FALSE');
  inactiveAccountIds.clear();
  for (const { id } of result.rows) inactiveAccountIds.add(Number(id));
}

export function setAccountActive(id, isActive) {
  const accountId = Number(id);
  if (isActive) inactiveAccountIds.delete(accountId);
  else inactiveAccountIds.add(accountId);
}

export function isAccountActive(id) {
  return !inactiveAccountIds.has(Number(id));
}
