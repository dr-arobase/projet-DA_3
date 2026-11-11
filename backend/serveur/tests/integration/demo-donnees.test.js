/**
 * Données de démonstration (database/demo.sql, #209), avec la VRAIE base PostgreSQL :
 * le script se charge, se relance sans doublon et donne des données crédibles.
 * Tout se passe dans une transaction annulée à la fin : la base n'est pas modifiée.
 * Si la base n'est pas joignable, ces tests sont ignorés.
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { readFile } from 'node:fs/promises';

process.env.JWT_SECRET ??= 'test-secret';

const { pool, initializeDatabase, closeDatabase } = await import('../../src/config/db.js');

const dbAvailable = await pool.query('SELECT 1').then(() => true, () => false);
const describeDb = dbAvailable ? describe : describe.skip;

const DOSSIERS = [
  ['Kevin', 'Ostiguy'], ['Sabrina', 'Lanthier'], ['Marc-André', 'Bouffard'], ['Yanick', 'Desormeaux'],
  ['Émilie', 'Ravary'], ['Jonathan', 'Brisebois'], ['Patrick', 'Lussier'], ['Mélissa', 'Corbeil'],
  ['Dominic', 'Vaillancourt'], ['Stéphane', 'Gendreau'], ['Alexandre', 'Pépin'], ['Karine', 'Daigle'], ['Luc', 'Hamelin'],
];
const DE_LA_DEMO = `(first_name, last_name) IN (${DOSSIERS.map((_, i) => `($${2 * i + 1}, $${2 * i + 2})`).join(', ')})`;
const PARAMS = DOSSIERS.flat();

let client;
let script;

beforeAll(async () => {
  if (!dbAvailable) return;
  await initializeDatabase();
  script = await readFile(new URL('../../database/demo.sql', import.meta.url), 'utf8');
  client = await pool.connect();
  await client.query('BEGIN');
  // Le script prend ses agents parmi les comptes existants : un compte de direction actif suffit
  await client.query(
    `INSERT INTO app_user (first_name, last_name, badge_number, email, password_hash, role, grade)
     VALUES ('Essai', 'Démo', 'TEST-DEMO', 'test-demo@crimetracker.local', 'x', 'direction', 'directeur_general')`
  );
});

afterAll(async () => {
  if (client) {
    await client.query('ROLLBACK');
    client.release();
  }
  await closeDatabase();
});

describeDb('Données de démonstration (demo.sql)', () => {
  test('le script se charge, et une deuxième fois sans rien ajouter', async () => {
    await client.query(script);
    const compter = async () => (await client.query(
      `SELECT (SELECT count(*) FROM criminal WHERE ${DE_LA_DEMO})::int AS dossiers,
              (SELECT count(*) FROM sighting s JOIN criminal c ON c.id = s.criminal_id WHERE ${DE_LA_DEMO.replace(/first_name/g, 'c.first_name').replace(/last_name/g, 'c.last_name')})::int AS signalements,
              (SELECT count(*) FROM alert a JOIN criminal c ON c.id = a.criminal_id WHERE ${DE_LA_DEMO.replace(/first_name/g, 'c.first_name').replace(/last_name/g, 'c.last_name')})::int AS alertes`,
      PARAMS
    )).rows[0];
    const premier = await compter();
    expect(premier).toEqual({ dossiers: 13, signalements: 17, alertes: 6 });

    await client.query(script);
    expect(await compter()).toEqual(premier);
  });

  test('les trois statuts sont représentés', async () => {
    const { rows } = await client.query(
      `SELECT status, count(*)::int AS n FROM criminal WHERE ${DE_LA_DEMO} GROUP BY status ORDER BY status`, PARAMS
    );
    expect(Object.fromEntries(rows.map((r) => [r.status, r.n]))).toEqual({ recherche: 8, capture: 3, libere: 2 });
  });

  test('alertes urgentes et communiqués, chacun à sa place et sous 500 caractères', async () => {
    const { rows } = await client.query(
      `SELECT a.severity, length(a.message) AS longueur, c.status
         FROM alert a JOIN criminal c ON c.id = a.criminal_id WHERE ${DE_LA_DEMO.replace(/first_name/g, 'c.first_name').replace(/last_name/g, 'c.last_name')}`,
      PARAMS
    );
    expect(rows.filter((r) => r.severity === 'urgent')).toHaveLength(3);
    // Une alerte urgente vise toujours une personne encore recherchée
    rows.filter((r) => r.severity === 'urgent').forEach((r) => expect(r.status).toBe('recherche'));
    rows.forEach((r) => expect(r.longueur).toBeLessThanOrEqual(500));
    const general = await client.query("SELECT count(*)::int AS n FROM alert WHERE severity = 'info' AND criminal_id IS NULL AND message LIKE 'Rappel : un signalement utile%'");
    expect(general.rows[0].n).toBe(1);
  });

  test('les signalements sont placés dans Montréal et répartis sur plusieurs jours', async () => {
    const { rows } = await client.query(
      `SELECT s.latitude, s.longitude, s.reported_at FROM sighting s JOIN criminal c ON c.id = s.criminal_id
        WHERE ${DE_LA_DEMO.replace(/first_name/g, 'c.first_name').replace(/last_name/g, 'c.last_name')}`,
      PARAMS
    );
    rows.forEach((r) => {
      expect(r.latitude).toBeGreaterThan(45.4);
      expect(r.latitude).toBeLessThan(45.71);
      expect(r.longitude).toBeGreaterThan(-73.98);
      expect(r.longitude).toBeLessThan(-73.47);
      expect(new Date(r.reported_at).getTime()).toBeLessThanOrEqual(Date.now());
    });
    const jours = new Set(rows.map((r) => new Date(r.reported_at).toISOString().slice(0, 10)));
    expect(jours.size).toBeGreaterThanOrEqual(5);
  });
});
