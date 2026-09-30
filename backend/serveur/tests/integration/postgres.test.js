/**
 * Tests d'intégration avec la VRAIE base PostgreSQL (conteneur crimetracker-db).
 *
 * Si la base n'est pas joignable, ces tests sont ignorés (skipped) au lieu d'échouer.
 * Pour les exécuter : docker start crimetracker-db
 *
 * Les tests créent leurs propres données (matricule TEST-JEST) et les suppriment à la fin.
 */
import { jest, describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcrypt';

process.env.JWT_SECRET ??= 'test-secret';

const { pool, initializeDatabase, closeDatabase } = await import('../../src/config/db.js');
const { default: app } = await import('../../src/app.js');
const { default: dossierRouter } = await import('../../src/routes/dossier.js');
const { signToken } = await import('../../src/utils/jwt.js');

const dbAvailable = await pool.query('SELECT 1').then(() => true, () => false);
const describeDb = dbAvailable ? describe : describe.skip;

const BADGE = 'TEST-JEST';
const PASSWORD = 'MotDePasseTest!';
let userId;

// Jetons signés pour l'utilisateur de test, avec le rôle voulu (RBAC)
const bearer = (role = 'policier') =>
  `Bearer ${signToken({ id: userId, badge_number: BADGE, role, grade: 'sergent_autres_fonctions' })}`;

const dossierApp = express();
dossierApp.use(express.json());
dossierApp.use('/api/dossiers', dossierRouter);

async function cleanUp() {
  const byTestUser = '(SELECT id FROM app_user WHERE badge_number = $1)';
  await pool.query(`DELETE FROM audit_log WHERE actor_id IN ${byTestUser}`, [BADGE]);
  await pool.query(`DELETE FROM alert WHERE issued_by IN ${byTestUser}`, [BADGE]);
  await pool.query(`DELETE FROM sighting WHERE reported_by IN ${byTestUser}`, [BADGE]);
  await pool.query(
    'DELETE FROM criminal WHERE added_by IN (SELECT id FROM app_user WHERE badge_number = $1)',
    [BADGE]
  );
  await pool.query('DELETE FROM app_user WHERE badge_number = $1', [BADGE]);
}

beforeAll(async () => {
  if (!dbAvailable) return;
  await initializeDatabase();
  await cleanUp();
  const hash = await bcrypt.hash(PASSWORD, 4);
  const { rows } = await pool.query(
    `INSERT INTO app_user (first_name, last_name, badge_number, email, password_hash, role, grade)
     VALUES ('Test', 'Jest', $1, 'test-jest@crimetracker.local', $2, 'policier', 'sergent_autres_fonctions')
     RETURNING id`,
    [BADGE, hash]
  );
  userId = rows[0].id;
});

afterAll(async () => {
  if (dbAvailable) await cleanUp();
  await closeDatabase();
});

describeDb('Intégration PostgreSQL', () => {
  describe('schéma', () => {
    test('toutes les tables existent', async () => {
      const { rows } = await pool.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
      );
      const tables = rows.map((r) => r.table_name);

      expect(tables).toEqual(
        expect.arrayContaining(['app_user', 'criminal', 'sighting', 'alert', 'audit_log'])
      );
    });

    test('initializeDatabase est idempotent (peut être relancé)', async () => {
      await expect(initializeDatabase()).resolves.not.toThrow();
    });
  });

  describe('authentification', () => {
    let token;

    test('login réussi avec un vrai hash bcrypt', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ badge_number: BADGE, password: PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ id: userId, badge_number: BADGE, role: 'policier' });
      token = res.body.token;
    });

    test('login refusé avec un mauvais mot de passe', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ badge_number: BADGE, password: 'faux' });

      expect(res.status).toBe(401);
    });

    test('logout avec le jeton obtenu', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    test('login refusé si le compte est désactivé', async () => {
      await pool.query('UPDATE app_user SET is_active = false WHERE id = $1', [userId]);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ badge_number: BADGE, password: PASSWORD });

      expect(res.status).toBe(401);
      await pool.query('UPDATE app_user SET is_active = true WHERE id = $1', [userId]);
    });
  });

  describe('dossiers criminels', () => {
    let criminalId;

    test('POST crée un dossier', async () => {
      const res = await request(dossierApp).post('/api/dossiers').send({
        first_name: 'Test',
        last_name: 'Integration',
        description: 'Créé par Jest',
        status: 'recherche',
        added_by: userId,
      });

      expect(res.status).toBe(201);
      expect(res.body.criminal).toMatchObject({ last_name: 'Integration', status: 'recherche', version: 1 });
      criminalId = res.body.criminal.id;
    });

    test('GET /api/criminals liste le nouveau dossier', async () => {
      const res = await request(app)
        .get('/api/criminals?limit=100')
        .set('Authorization', bearer());

      expect(res.status).toBe(200);
      expect(res.body.data.map((c) => c.id)).toContain(criminalId);
    });

    test('GET /api/dossiers/:id renvoie le dossier', async () => {
      const res = await request(dossierApp).get(`/api/dossiers/${criminalId}`);

      expect(res.status).toBe(200);
      expect(res.body.description).toBe('Créé par Jest');
    });

    test('PUT met à jour le dossier et le trigger incrémente la version', async () => {
      const res = await request(dossierApp).put(`/api/dossiers/${criminalId}`).send({
        first_name: 'Test',
        last_name: 'Integration',
        description: 'Modifié',
        status: 'capture',
      });

      expect(res.status).toBe(200);
      expect(res.body.criminal).toMatchObject({ description: 'Modifié', status: 'capture', version: 2 });
    });

    test('PATCH change le statut et incrémente encore la version', async () => {
      const res = await request(dossierApp)
        .patch(`/api/dossiers/${criminalId}/status`)
        .send({ status: 'libere' });

      expect(res.status).toBe(200);
      expect(res.body.criminal).toMatchObject({ status: 'libere', version: 3 });
    });

    test('PATCH avec un statut hors ENUM est refusé par la base (500)', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const res = await request(dossierApp)
        .patch(`/api/dossiers/${criminalId}/status`)
        .send({ status: 'INCONNU' });

      expect(res.status).toBe(500);
      spy.mockRestore();
    });

    test('GET d\'un dossier inexistant renvoie 404', async () => {
      const res = await request(dossierApp).get('/api/dossiers/99999999');

      expect(res.status).toBe(404);
    });
  });
  describe('API /api/criminals (verrouillage optimiste, rôles, temps réel)', () => {
    let criminalId;
    let version;

    test('POST crée un dossier au nom de l\'agent connecté', async () => {
      const res = await request(app)
        .post('/api/criminals')
        .set('Authorization', bearer())
        .send({ first_name: 'Api', last_name: 'Integration', crimes: 'Vol' });

      expect(res.status).toBe(201);
      expect(res.body.criminal).toMatchObject({
        last_name: 'Integration', status: 'recherche', version: 1, added_by: 'Test Jest',
      });
      criminalId = res.body.criminal.id;
      version = res.body.criminal.version;
    });

    test('GET filtre par statut et renvoie le total', async () => {
      const res = await request(app)
        .get('/api/criminals?status=recherche&limit=100')
        .set('Authorization', bearer());

      expect(res.status).toBe(200);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
      expect(res.body.data.every((c) => c.status === 'recherche')).toBe(true);
    });

    test('PATCH status avec la bonne version réussit et le trigger incrémente la version', async () => {
      const res = await request(app)
        .patch(`/api/criminals/${criminalId}/status`)
        .set('Authorization', bearer())
        .send({ status: 'capture', version });

      expect(res.status).toBe(200);
      expect(res.body.criminal).toMatchObject({ status: 'capture', version: version + 1 });
    });

    test('PATCH status avec une version périmée renvoie 409 et l\'état courant', async () => {
      const res = await request(app)
        .patch(`/api/criminals/${criminalId}/status`)
        .set('Authorization', bearer())
        .send({ status: 'libere', version });

      expect(res.status).toBe(409);
      expect(res.body.criminal).toMatchObject({ status: 'capture', version: version + 1 });
    });

    test('PUT est refusé à un policier (403)', async () => {
      const res = await request(app)
        .put(`/api/criminals/${criminalId}`)
        .set('Authorization', bearer())
        .send({ first_name: 'Api', last_name: 'Integration' });

      expect(res.status).toBe(403);
    });

    test('PUT par un superviseur met à jour le dossier', async () => {
      const res = await request(app)
        .put(`/api/criminals/${criminalId}`)
        .set('Authorization', bearer('superviseur'))
        .send({ first_name: 'Api', last_name: 'Modifié', description: 'Mis à jour' });

      expect(res.status).toBe(200);
      expect(res.body.criminal).toMatchObject({ last_name: 'Modifié', updated_by: 'Test Jest' });
    });

    test('POST /api/sightings signale une observation', async () => {
      const res = await request(app)
        .post('/api/sightings')
        .set('Authorization', bearer())
        .send({ criminal_id: criminalId, location: 'Montréal', notes: 'Vu au métro' });

      expect(res.status).toBe(201);
      expect(res.body.sighting).toMatchObject({ criminal_id: criminalId, reported_by: 'Test Jest' });
    });

    test('GET /api/sightings (superviseur) renvoie l\'historique', async () => {
      const res = await request(app)
        .get(`/api/sightings?criminal_id=${criminalId}`)
        .set('Authorization', bearer('superviseur'));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    test('POST /api/alerts (superviseur) diffuse une alerte et l\'inscrit au journal', async () => {
      const res = await request(app)
        .post('/api/alerts')
        .set('Authorization', bearer('superviseur'))
        .send({ message: 'Individu dangereux', severity: 'urgent', criminal_id: criminalId });

      expect(res.status).toBe(201);
      expect(res.body.alert).toMatchObject({ severity: 'urgent', issued_by: 'Test Jest' });
    });

    test('DELETE par un superviseur retire le dossier', async () => {
      const res = await request(app)
        .delete(`/api/criminals/${criminalId}`)
        .set('Authorization', bearer('superviseur'));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(criminalId);
    });

    test('GET /api/audit-logs (direction) contient les actions sensibles', async () => {
      const res = await request(app)
        .get('/api/audit-logs?limit=100')
        .set('Authorization', bearer('direction'));

      expect(res.status).toBe(200);
      const actions = res.body.data.filter((l) => l.actor === 'Test Jest').map((l) => l.action);
      expect(actions).toEqual(expect.arrayContaining(['ALERT_ISSUED', 'CRIMINAL_REMOVED']));
    });
  });
});
