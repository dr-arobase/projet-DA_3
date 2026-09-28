import request from 'supertest';
import app from '../src/app.js';
import { initializeDatabase, pool } from '../src/config/db.js';

export const PASSWORD = 'Demo1234!';

/**
 * Vide la base de test et la recrée avec schema.sql et seed.sql, comme au
 * premier démarrage. Refuse de toucher une base dont le nom ne finit pas par _test.
 */
export async function resetDatabase() {
  const { rows } = await pool.query('SELECT current_database() AS name');
  if (!rows[0].name.endsWith('_test')) {
    throw new Error(`Refus de vider la base « ${rows[0].name} » : les tests exigent une base *_test.`);
  }
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await initializeDatabase();
}

/** Un client HTTP qui garde le cookie de session du compte donné. */
export async function loginAs(badgeNumber) {
  const agent = request.agent(app);
  const res = await agent.post('/auth/login').send({ badge_number: badgeNumber, password: PASSWORD });
  if (res.status !== 200) throw new Error(`Connexion de ${badgeNumber} impossible : ${res.status}`);
  return agent;
}
