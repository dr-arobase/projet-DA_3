/**
 * Récit R2 (#205) : concurrence prouvée, avec la VRAIE base PostgreSQL.
 *
 * Deux agents envoient EN MÊME TEMPS une modification du même dossier, avec la même version.
 * Résultat attendu : une seule réussit (200), l'autre reçoit 409 avec l'état actuel du dossier;
 * pas de doublon, pas de perte silencieuse (voir « Point de concurrence » dans 03-conception.md).
 *
 * Pourquoi c'est sûr : la vérification et l'écriture sont une seule requête
 * (UPDATE … WHERE id = $id AND version = $version). PostgreSQL fait attendre la seconde requête
 * sur le verrou de la ligne; quand la première a fini, la seconde revoit sa condition, trouve
 * la nouvelle version, et ne modifie rien.
 *
 * Si la base n'est pas joignable, ces tests sont ignorés. Pour les exécuter : docker start crimetracker-db
 */
import { describe, test, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';

process.env.JWT_SECRET ??= 'test-secret';

const { pool, initializeDatabase, closeDatabase } = await import('../../src/config/db.js');
const { default: app } = await import('../../src/app.js');
const { signToken } = await import('../../src/utils/jwt.js');

const dbAvailable = await pool.query('SELECT 1').then(() => true, () => false);
const describeDb = dbAvailable ? describe : describe.skip;

const BADGE = 'TEST-CONCURRENCE';
let userId;
let dossierId;

// Le rôle vient du compte en base : l'agent de test est superviseur (statut ET modification complète)
const bearer = () =>
  `Bearer ${signToken({ id: userId, badge_number: BADGE, role: 'superviseur', grade: 'lieutenant' })}`;

const changerStatut = (status, version) =>
  request(app).patch(`/api/criminals/${dossierId}/status`).set('Authorization', bearer()).send({ status, version });

const modifier = (champs, version) =>
  request(app).put(`/api/criminals/${dossierId}`).set('Authorization', bearer())
    .send({ first_name: 'Paul', last_name: 'Concurrent', ...champs, version });

const lireDossier = async () =>
  (await pool.query('SELECT status, version, description, crimes FROM criminal WHERE id = $1', [dossierId])).rows[0];

const journalDuDossier = async (action) =>
  (await pool.query(
    "SELECT COUNT(*)::int AS n FROM audit_log WHERE target_type = 'criminal' AND target_id = $1 AND action = $2",
    [dossierId, action]
  )).rows[0].n;

// Sépare les réponses : exactement une réussite, le reste en conflit
function trier(reponses) {
  const gagnants = reponses.filter((r) => r.status === 200);
  const perdants = reponses.filter((r) => r.status === 409);
  return { gagnants, perdants, autres: reponses.filter((r) => ![200, 409].includes(r.status)) };
}

async function cleanUp() {
  const parAgent = '(SELECT id FROM app_user WHERE badge_number = $1)';
  await pool.query(`DELETE FROM audit_log WHERE actor_id IN ${parAgent}`, [BADGE]);
  await pool.query(`DELETE FROM criminal WHERE added_by IN ${parAgent}`, [BADGE]);
  await pool.query('DELETE FROM app_user WHERE badge_number = $1', [BADGE]);
}

beforeAll(async () => {
  if (!dbAvailable) return;
  await initializeDatabase();
  await cleanUp();
  const { rows } = await pool.query(
    `INSERT INTO app_user (first_name, last_name, badge_number, email, password_hash, role, grade)
     VALUES ('Essai', 'Concurrence', $1, 'test-concurrence@crimetracker.local', 'x', 'superviseur', 'lieutenant')
     RETURNING id`,
    [BADGE]
  );
  userId = rows[0].id;
});

// Un dossier neuf pour chaque test : statut « recherche », version de départ connue
beforeEach(async () => {
  if (!dbAvailable) return;
  const { rows } = await pool.query(
    `INSERT INTO criminal (first_name, last_name, description, crimes, status, added_by)
     VALUES ('Paul', 'Concurrent', 'Description initiale', 'Vol', 'recherche', $1)
     RETURNING id`,
    [userId]
  );
  dossierId = rows[0].id;
});

afterAll(async () => {
  if (dbAvailable) await cleanUp();
  await closeDatabase();
});

describeDb('R2 : deux écritures simultanées sur le même dossier', () => {
  test('deux changements de statut en même temps : un 200, un 409 avec l\'état actuel', async () => {
    const { version } = await lireDossier();

    const reponses = await Promise.all([changerStatut('capture', version), changerStatut('libere', version)]);
    const { gagnants, perdants, autres } = trier(reponses);

    expect(autres).toEqual([]);
    expect(gagnants).toHaveLength(1);
    expect(perdants).toHaveLength(1);

    // Le perdant reçoit l'état réel : celui du gagnant, avec la nouvelle version
    const gagnant = gagnants[0].body.criminal;
    expect(perdants[0].body.criminal).toMatchObject({ status: gagnant.status, version: version + 1 });

    // En base : une seule écriture appliquée, rien de perdu en silence, pas de doublon
    expect(await lireDossier()).toMatchObject({ status: gagnant.status, version: version + 1 });
    expect(await journalDuDossier('CRIMINAL_STATUS_CHANGED')).toBe(1);
  });

  test('dix changements de statut en même temps avec la même version : un seul réussit', async () => {
    const { version } = await lireDossier();
    const statuts = ['capture', 'libere'];

    const reponses = await Promise.all(Array.from({ length: 10 }, (_, i) => changerStatut(statuts[i % 2], version)));
    const { gagnants, perdants, autres } = trier(reponses);

    expect(autres).toEqual([]);
    expect(gagnants).toHaveLength(1);
    expect(perdants).toHaveLength(9);
    for (const perdant of perdants) {
      expect(perdant.body.criminal.version).toBe(version + 1);
    }
    expect((await lireDossier()).version).toBe(version + 1);
    expect(await journalDuDossier('CRIMINAL_STATUS_CHANGED')).toBe(1);
  });

  test('deux modifications complètes en même temps : la description du gagnant reste, l\'autre reçoit 409', async () => {
    const { version } = await lireDossier();

    const reponses = await Promise.all([
      modifier({ description: 'Version de l\'agent A' }, version),
      modifier({ description: 'Version de l\'agent B' }, version),
    ]);
    const { gagnants, perdants, autres } = trier(reponses);

    expect(autres).toEqual([]);
    expect(gagnants).toHaveLength(1);
    expect(perdants).toHaveLength(1);
    const description = gagnants[0].body.criminal.description;
    expect(perdants[0].body.criminal).toMatchObject({ description, version: version + 1 });
    expect(await lireDossier()).toMatchObject({ description, version: version + 1 });
  });

  test('un changement de statut et une modification en même temps : rien n\'est perdu', async () => {
    const avant = await lireDossier();

    const [statut, modification] = await Promise.all([
      changerStatut('capture', avant.version),
      modifier({ description: 'Nouvelle description' }, avant.version),
    ]);

    expect([statut.status, modification.status].sort()).toEqual([200, 409]);
    const apres = await lireDossier();
    expect(apres.version).toBe(avant.version + 1);
    if (statut.status === 200) {
      // Le statut a gagné : la description n'a pas été écrasée
      expect(apres).toMatchObject({ status: 'capture', description: 'Description initiale' });
      expect(modification.body.criminal.status).toBe('capture');
    } else {
      // La modification a gagné : le statut n'a pas changé
      expect(apres).toMatchObject({ status: 'recherche', description: 'Nouvelle description' });
      expect(statut.body.criminal.description).toBe('Nouvelle description');
    }
  });

  test('le perdant peut réessayer avec la version qu\'il a reçue dans le 409', async () => {
    const { version } = await lireDossier();

    const reponses = await Promise.all([changerStatut('capture', version), changerStatut('libere', version)]);
    const { gagnants, perdants } = trier(reponses);
    const actuel = perdants[0].body.criminal;
    const statutVoulu = gagnants[0].body.criminal.status === 'capture' ? 'libere' : 'capture';

    const nouvelEssai = await changerStatut(statutVoulu, actuel.version);

    expect(nouvelEssai.status).toBe(200);
    expect(await lireDossier()).toMatchObject({ status: statutVoulu, version: version + 2 });
  });
});