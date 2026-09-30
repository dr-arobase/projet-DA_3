
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import pg from 'pg';

const ADMIN_URL = process.env.TEST_DATABASE_URL ?? 'postgres://crimetracker:crimetracker@localhost:5432/crimetracker';
const TEST_ROLES = {
  policier: 'sergent_autres_fonctions',
  superviseur: 'lieutenant',
  direction: 'directeur_general'
};
const TEST_BADGE_CODES = {
  policier: 'POL',
  superviseur: 'SUP',
  direction: 'DIR'
};

/** Exécute une commande d'administration sur la base PostgreSQL configurée pour les tests. */
async function admin(sql) {
  const client = new pg.Client({ connectionString: ADMIN_URL });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

/** Supprime les données liées aux comptes temporaires avant de supprimer ces comptes. */
async function deleteTestUsers(pool, userIds) {
  if (userIds.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM audit_log WHERE actor_id = ANY($1::int[])', [userIds]);
    await client.query('DELETE FROM alert WHERE issued_by = ANY($1::int[])', [userIds]);
    await client.query('DELETE FROM sighting WHERE reported_by = ANY($1::int[])', [userIds]);
    await client.query(
      'DELETE FROM criminal WHERE added_by = ANY($1::int[]) OR updated_by = ANY($1::int[])',
      [userIds]
    );
    await client.query('DELETE FROM app_user WHERE id = ANY($1::int[])', [userIds]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Crée un compte temporaire par rôle et retourne les informations non sensibles du compte. */
async function createTestUsers(pool, signToken, userIds) {
  const suffix = randomBytes(4).toString('hex');
  const users = {};

  for (const [role, grade] of Object.entries(TEST_ROLES)) {
    const password = `Test-${role}-${suffix}!`;
    const passwordHash = await bcrypt.hash(password, 10);
    const badgeNumber = `TST-${TEST_BADGE_CODES[role]}-${suffix}`;
    const email = `${role}.${suffix}@test.local`;
    const { rows } = await pool.query(
      `INSERT INTO app_user
        (first_name, last_name, badge_number, email, password_hash, role, grade, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       RETURNING id, first_name, last_name, badge_number, email, role, grade, is_active`,
      ['Compte', `Test ${role}`, badgeNumber, email, passwordHash, role, grade]
    );

    const user = rows[0];
    userIds.push(user.id);
    users[role] = { ...user, password, token: signToken(user) };
  }

  return users;
}

/** Crée une base isolée, initialise CrimeTracker et démarre l'API sur un port libre. */
export async function startServer() {
  const dbName = `crimetracker_test_${randomBytes(4).toString('hex')}`;
  await admin(`CREATE DATABASE ${dbName}`);

  const url = new URL(ADMIN_URL);
  url.pathname = `/${dbName}`;
  process.env.DATABASE_URL = url.href;
  process.env.JWT_SECRET = 'secret-jwt-pour-les-tests';

  let pool;
  let server;
  const testUserIds = [];

  try {
    // La configuration est définie avant ces imports, car le pool lit DATABASE_URL au chargement.
    const [{ default: app }, database, { signToken }] = await Promise.all([
      import('../src/app.js'),
      import('../src/config/db.js'),
      import('../src/utils/jwt.js')
    ]);
    pool = database.pool;
    await database.initializeDatabase();

    server = app.listen(0);
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const base = `http://localhost:${server.address().port}`;
    const users = await createTestUsers(pool, signToken, testUserIds);

    return {
      base,
      users,
      /** Envoie une requête et retourne son statut ainsi que son corps JSON ou texte. */
      async request(method, path, body, token, extraHeaders = {}) {
        const headers = { ...extraHeaders };
        if (body !== undefined) headers['content-type'] = 'application/json';
        if (token) headers.authorization = `Bearer ${token}`;

        const response = await fetch(base + path, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body)
        });
        const text = await response.text();
        let data = text;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          // Les réponses HTML, comme Swagger UI, sont retournées en texte.
        }
        return { status: response.status, data };
      },
      /** Retourne le JWT temporaire du compte de test demandé par rôle. */
      tokenFor(role = 'policier') {
        const user = users[role];
        if (!user) throw new Error(`Aucun compte de test pour le rôle ${role}`);
        return user.token;
      },
      async close() {
        try {
          if (server) {
            await new Promise((resolve) => server.close(resolve));
          }
          await deleteTestUsers(pool, testUserIds);
        } finally {
          try {
            await pool.end();
          } finally {
            await admin(`DROP DATABASE ${dbName}`);
          }
        }
      }
    };
  } catch (error) {
    if (server?.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (pool) {
      await deleteTestUsers(pool, testUserIds).catch(() => {});
      await pool.end().catch(() => {});
    }
    await admin(`DROP DATABASE ${dbName}`).catch(() => {});
    throw error;
  }
}
