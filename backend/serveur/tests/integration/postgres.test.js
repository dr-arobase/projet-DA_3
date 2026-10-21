/**
 * Tests d'intégration avec la VRAIE base PostgreSQL (conteneur crimetracker-db).
 *
 * Si la base n'est pas joignable, ces tests sont ignorés (skipped) au lieu d'échouer.
 * Pour les exécuter : docker start crimetracker-db
 *
 * Les tests créent leurs propres données (matricule TEST-JEST) et les suppriment à la fin.
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';

process.env.JWT_SECRET ??= 'test-secret';

const { pool, initializeDatabase, closeDatabase } = await import('../../src/config/db.js');
const { default: app } = await import('../../src/app.js');
const { signToken } = await import('../../src/utils/jwt.js');

const dbAvailable = await pool.query('SELECT 1').then(() => true, () => false);
const describeDb = dbAvailable ? describe : describe.skip;

const BADGE = 'TEST-JEST';
const BADGE_2 = 'TEST-JEST-2'; // second agent, pour les groupes de la messagerie
const PASSWORD = 'MotDePasseTest!';
let userId;
let userId2;

// Jetons signés pour l'utilisateur de test, avec le rôle voulu (RBAC)
const bearer = (role = 'policier') =>
  `Bearer ${signToken({ id: userId, badge_number: BADGE, role, grade: 'sergent_autres_fonctions' })}`;

async function cleanUp() {
  const byTestUser = '(SELECT id FROM app_user WHERE badge_number = $1)';
  // Groupes et messages des deux agents de test (la suppression du groupe emporte ses messages)
  const testUsers = `(SELECT id FROM app_user WHERE badge_number IN ($1, $2))`;
  await pool.query(`DELETE FROM message_group WHERE created_by IN ${testUsers}`, [BADGE, BADGE_2]);
  await pool.query(`DELETE FROM message_group_member WHERE user_id IN ${testUsers}`, [BADGE, BADGE_2]);
  await pool.query(
    `DELETE FROM message WHERE sender_id IN ${testUsers} OR recipient_id IN ${testUsers}`,
    [BADGE, BADGE_2]
  );
  await pool.query('DELETE FROM app_user WHERE badge_number = $1', [BADGE_2]);
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
  const second = await pool.query(
    `INSERT INTO app_user (first_name, last_name, badge_number, email, password_hash, role, grade)
     VALUES ('Test', 'Jest Deux', $1, 'test-jest-2@crimetracker.local', $2, 'policier', 'sergent_autres_fonctions')
     RETURNING id`,
    [BADGE_2, hash]
  );
  userId2 = second.rows[0].id;
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
        expect.arrayContaining([
          'app_user',
          'criminal',
          'sighting',
          'alert',
          'audit_log',
          'login_rate_limit',
        ])
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
      await pool.query("UPDATE app_user SET role = 'superviseur' WHERE id = $1", [userId]);
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
      await pool.query("UPDATE app_user SET role = 'superviseur' WHERE id = $1", [userId]);
      const res = await request(app)
        .get(`/api/sightings?criminal_id=${criminalId}`)
        .set('Authorization', bearer('superviseur'));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    test('POST /api/alerts (superviseur) diffuse une alerte et l\'inscrit au journal', async () => {
      await pool.query("UPDATE app_user SET role = 'superviseur' WHERE id = $1", [userId]);
      const res = await request(app)
        .post('/api/alerts')
        .set('Authorization', bearer('superviseur'))
        .send({ message: 'Individu dangereux', severity: 'urgent', criminal_id: criminalId });

      expect(res.status).toBe(201);
      expect(res.body.alert).toMatchObject({ severity: 'urgent', issued_by: 'Test Jest' });
    });

    test('DELETE par un superviseur retire le dossier', async () => {
      await pool.query("UPDATE app_user SET role = 'superviseur' WHERE id = $1", [userId]);
      const res = await request(app)
        .delete(`/api/criminals/${criminalId}`)
        .set('Authorization', bearer('superviseur'));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(criminalId);
    });

    test('GET /api/audit-logs (direction) contient les actions sensibles', async () => {
      await pool.query("UPDATE app_user SET role = 'direction' WHERE id = $1", [userId]);
      const res = await request(app)
        .get('/api/audit-logs?limit=100')
        .set('Authorization', bearer('direction'));

      expect(res.status).toBe(200);
      const actions = res.body.data.filter((l) => l.actor === 'Test Jest').map((l) => l.action);
      expect(actions).toEqual(expect.arrayContaining(['ALERT_ISSUED', 'CRIMINAL_REMOVED']));
    });
  });

  describe('API /api/messages/groups (groupes de la messagerie)', () => {
    const agent2 = () => `Bearer ${signToken({ id: userId2, badge_number: BADGE_2, role: 'policier' })}`;
    let groupId;

    test('création : le créateur et le membre choisi sont dans le groupe', async () => {
      const res = await request(app)
        .post('/api/messages/groups')
        .set('Authorization', bearer())
        .send({ name: 'Groupe de test', member_ids: [userId2] });

      expect(res.status).toBe(201);
      expect(res.body.created_by).toBe(userId);
      expect(res.body.members.map((m) => m.id).sort()).toEqual([userId, userId2].sort());
      groupId = res.body.id;
    });

    test("un message du créateur est non lu pour l'autre membre, puis lu après lecture", async () => {
      const envoi = await request(app)
        .post(`/api/messages/groups/${groupId}/messages`)
        .set('Authorization', bearer())
        .send({ body: 'Rendez-vous au poste' });
      expect(envoi.status).toBe(201);
      expect(envoi.body.data.sender_last_name).toBe('Jest');

      const avant = await request(app).get('/api/messages/groups').set('Authorization', agent2());
      expect(Number(avant.body.find((g) => g.id === groupId).unread)).toBe(1);

      const fil = await request(app).get(`/api/messages/groups/${groupId}`).set('Authorization', agent2());
      expect(fil.body.messages.map((m) => m.body)).toEqual(['Rendez-vous au poste']);

      const apres = await request(app).get('/api/messages/groups').set('Authorization', agent2());
      expect(Number(apres.body.find((g) => g.id === groupId).unread)).toBe(0);
    });

    test("le créateur quitte : l'autre membre devient gestionnaire; il quitte à son tour : le groupe disparaît", async () => {
      const depart = await request(app)
        .delete(`/api/messages/groups/${groupId}/members/${userId}`)
        .set('Authorization', bearer());
      expect(depart.status).toBe(200);
      expect(depart.body.created_by).toBe(userId2);

      const dernier = await request(app)
        .delete(`/api/messages/groups/${groupId}/members/${userId2}`)
        .set('Authorization', agent2());
      expect(dernier.body.created_by).toBeNull();

      const { rows } = await pool.query('SELECT 1 FROM message_group WHERE id = $1', [groupId]);
      expect(rows).toHaveLength(0);
    });

    test('la base refuse un message sans destinataire ni groupe', async () => {
      await expect(
        pool.query('INSERT INTO message (sender_id, body) VALUES ($1, $2)', [userId, 'Perdu'])
      ).rejects.toThrow(/message_destination/);
    });
  });
});
