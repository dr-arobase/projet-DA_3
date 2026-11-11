/**
 * Alertes et communiqués sans limite de caractères (#219), avec la VRAIE base PostgreSQL :
 * la colonne alert.message est un TEXT, et un très long message revient intact de l'API.
 * Si la base n'est pas joignable, ces tests sont ignorés.
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

process.env.JWT_SECRET ??= 'test-secret';

const { pool, initializeDatabase, closeDatabase } = await import('../../src/config/db.js');
const { default: app } = await import('../../src/app.js');
const { signToken } = await import('../../src/utils/jwt.js');

const dbAvailable = await pool.query('SELECT 1').then(() => true, () => false);
const describeDb = dbAvailable ? describe : describe.skip;

const BADGE = 'TEST-LONGUE';
let userId;

async function cleanUp() {
  await pool.query('DELETE FROM audit_log WHERE actor_id IN (SELECT id FROM app_user WHERE badge_number = $1)', [BADGE]);
  await pool.query('DELETE FROM alert WHERE issued_by IN (SELECT id FROM app_user WHERE badge_number = $1)', [BADGE]);
  await pool.query('DELETE FROM app_user WHERE badge_number = $1', [BADGE]);
}

beforeAll(async () => {
  if (!dbAvailable) return;
  await initializeDatabase();
  await cleanUp();
  const { rows } = await pool.query(
    `INSERT INTO app_user (first_name, last_name, badge_number, email, password_hash, role, grade)
     VALUES ('Essai', 'Longue', $1, 'test-longue@crimetracker.local', 'x', 'direction', 'directeur_general') RETURNING id`,
    [BADGE]
  );
  userId = rows[0].id;
});

afterAll(async () => {
  if (dbAvailable) await cleanUp();
  await closeDatabase();
});

describeDb('Diffusion sans limite de caractères', () => {
  test('la colonne alert.message est un TEXT (plus de VARCHAR(500))', async () => {
    const { rows } = await pool.query(
      "SELECT data_type, character_maximum_length FROM information_schema.columns WHERE table_name = 'alert' AND column_name = 'message'"
    );
    expect(rows[0]).toEqual({ data_type: 'text', character_maximum_length: null });
  });

  test.each(['urgent', 'info'])('une diffusion « %s » de 20 000 caractères est enregistrée et relue intacte', async (severity) => {
    const message = `Communiqué complet : ${'Témoins recherchés, appelez le poste. '.repeat(560)}`.slice(0, 20000);
    const bearer = `Bearer ${signToken({ id: userId, badge_number: BADGE, role: 'direction', grade: 'directeur_general' })}`;
    const envoi = await request(app).post('/api/alerts').set('Authorization', bearer).send({ message, severity });
    expect(envoi.status).toBe(201);

    const { rows } = await pool.query('SELECT message FROM alert WHERE id = $1', [envoi.body.alert.id]);
    expect(rows[0].message).toHaveLength(20000);
    expect(rows[0].message).toBe(message);
  });
});
