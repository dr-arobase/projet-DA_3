/**
 * Accents (#62), avec la VRAIE base PostgreSQL : un texte accentué revient intact de l'API,
 * et une donnée de départ abîmée (« arm?? ») est réparée au démarrage.
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

const BADGE = 'TEST-ACCENTS';
const TEXTE = 'Individu armé, vu près de l’Île-des-Sœurs à 23 h — prudence: « ça déraille »';
let userId;

async function cleanUp() {
  // Diffuser une alerte écrit aussi dans le journal d'audit
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
     VALUES ('Hélène', 'Côté', $1, 'test-accents@crimetracker.local', 'x', 'superviseur', 'lieutenant')
     RETURNING id`,
    [BADGE]
  );
  userId = rows[0].id;
});

afterAll(async () => {
  if (dbAvailable) await cleanUp();
  await closeDatabase();
});

describeDb('Accents (UTF-8)', () => {
  const bearer = () => `Bearer ${signToken({ id: userId, badge_number: BADGE, role: 'superviseur', grade: 'lieutenant' })}`;

  test('un texte accentué envoyé à l\'API revient intact', async () => {
    const envoi = await request(app)
      .post('/api/alerts')
      .set('Authorization', bearer())
      .send({ message: TEXTE, severity: 'info' });
    expect(envoi.status).toBe(201);
    expect(envoi.body.alert.message).toBe(TEXTE);
    expect(envoi.body.alert.issued_by).toBe('Hélène Côté');

    const { rows } = await pool.query('SELECT message FROM alert WHERE id = $1', [envoi.body.alert.id]);
    expect(rows[0].message).toBe(TEXTE);
  });

  test('une alerte de départ abîmée est réparée au démarrage, sans toucher aux autres', async () => {
    const { rows } = await pool.query(
      `INSERT INTO alert (issued_by, message, severity)
       VALUES ($1, 'Individu potentiellement arm??, prudence recommand??e.', 'urgent') RETURNING id`,
      [userId]
    );

    await initializeDatabase();

    const repare = await pool.query('SELECT message FROM alert WHERE id = $1', [rows[0].id]);
    expect(repare.rows[0].message).toBe('Individu potentiellement armé, prudence recommandée.');
  });
});
