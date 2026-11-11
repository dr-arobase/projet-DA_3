/**
 * Double authentification (TOTP), avec la VRAIE base PostgreSQL : activation, connexion en deux
 * étapes, anti-rejeu, codes de secours, blocage après 5 erreurs, désactivation et réinitialisation.
 * Si la base n'est pas joignable, ces tests sont ignorés.
 */
import { describe, test, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';

process.env.JWT_SECRET ??= 'test-secret';

const { pool, initializeDatabase, closeDatabase } = await import('../../src/config/db.js');
const { default: app } = await import('../../src/app.js');
const { signToken } = await import('../../src/utils/jwt.js');
const { codePourPas, pasActuel } = await import('../../src/utils/totp.js');

const dbAvailable = await pool.query('SELECT 1').then(() => true, () => false);
const describeDb = dbAvailable ? describe : describe.skip;

const AGENT = 'TEST-2FA-AGENT';
const DIRECTION = 'TEST-2FA-DIR';
const MOT_DE_PASSE = 'Deux-Facteurs-2026';
const ids = {};

async function cleanUp() {
  await pool.query('DELETE FROM audit_log WHERE actor_id IN (SELECT id FROM app_user WHERE badge_number IN ($1, $2)) OR (target_type = \'user\' AND target_id IN (SELECT id FROM app_user WHERE badge_number IN ($1, $2)))', [AGENT, DIRECTION]);
  await pool.query('DELETE FROM app_user WHERE badge_number IN ($1, $2)', [AGENT, DIRECTION]);
}

beforeAll(async () => {
  if (!dbAvailable) return;
  await initializeDatabase();
  await cleanUp();
  const hash = await bcrypt.hash(MOT_DE_PASSE, 10);
  for (const [badge, role, grade] of [[AGENT, 'policier', 'sergent_autres_fonctions'], [DIRECTION, 'direction', 'directeur_general']]) {
    const { rows } = await pool.query(
      `INSERT INTO app_user (first_name, last_name, badge_number, email, password_hash, role, grade)
       VALUES ('Essai', 'Deux facteurs', $1, $2, $3, $4, $5) RETURNING id`,
      [badge, `${badge.toLowerCase()}@crimetracker.local`, hash, role, grade]
    );
    ids[badge] = rows[0].id;
  }
});

afterAll(async () => {
  if (dbAvailable) await cleanUp();
  await closeDatabase();
});

// Tous les essais viennent de la même adresse : la limite de 5 échecs par adresse IP (#89),
// qui compte aussi les mauvais codes, est remise à zéro entre deux tests.
beforeEach(async () => {
  if (dbAvailable) await pool.query('DELETE FROM login_rate_limit');
});

const bearer = (badge, role) => `Bearer ${signToken({ id: ids[badge], badge_number: badge, role, grade: 'x' })}`;
const connexion = (agent) => agent.post('/api/auth/login').send({ badge_number: AGENT, password: MOT_DE_PASSE });
const aUneSession = (res) => (res.headers['set-cookie'] || []).some((c) => c.startsWith('crimetracker_session=') && !c.startsWith('crimetracker_session=;'));

describeDb('Double authentification', () => {
  let secret;
  let codesSecours;

  test('activer : code QR, puis premier code; 10 codes de secours renvoyés une seule fois', async () => {
    const prep = await request(app).post('/api/auth/2fa/preparer').set('Authorization', bearer(AGENT, 'policier'));
    expect(prep.status).toBe(200);
    expect(prep.body.adresse).toMatch(/^otpauth:\/\/totp\//);
    secret = prep.body.secret;

    const mauvais = await request(app).post('/api/auth/2fa/activer').set('Authorization', bearer(AGENT, 'policier')).send({ code: '000000' });
    expect(mauvais.status).toBe(400);

    const act = await request(app).post('/api/auth/2fa/activer').set('Authorization', bearer(AGENT, 'policier'))
      .send({ code: codePourPas(secret, pasActuel()) });
    expect(act.status).toBe(200);
    expect(act.body.codesSecours).toHaveLength(10);
    expect(act.body.user.totp_active).toBe(true);
    codesSecours = act.body.codesSecours;

    // En base : secret chiffré, codes hachés, rien en clair
    const { rows } = await pool.query('SELECT totp_secret, totp_codes_secours FROM app_user WHERE id = $1', [ids[AGENT]]);
    expect(rows[0].totp_secret).not.toContain(secret);
    expect(rows[0].totp_codes_secours.join(' ')).not.toContain(codesSecours[0].replace('-', ''));
  });

  test('le mot de passe seul ne donne pas de session : la deuxième étape est demandée', async () => {
    const agent = request.agent(app);
    const res = await connexion(agent);
    expect(res.status).toBe(200);
    expect(res.body.deuxFacteurs).toBe(true);
    expect(res.body.token).toBeUndefined();
    expect(aUneSession(res)).toBe(false);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  test('sans la première étape, un code est refusé', async () => {
    const res = await request(app).post('/api/auth/login/code').send({ code: codePourPas(secret, pasActuel() + 1) });
    expect(res.status).toBe(401);
  });

  test('un mauvais code est refusé; le bon code ouvre la session; le même code ne sert pas deux fois', async () => {
    const agent = request.agent(app);
    await connexion(agent);
    expect((await agent.post('/api/auth/login/code').send({ code: '123456' })).status).toBe(401);

    const code = codePourPas(secret, pasActuel() + 1);
    const ok = await agent.post('/api/auth/login/code').send({ code });
    expect(ok.status).toBe(200);
    expect(ok.body.user.badge_number).toBe(AGENT);
    expect(aUneSession(ok)).toBe(true);

    const autre = request.agent(app);
    await connexion(autre);
    expect((await autre.post('/api/auth/login/code').send({ code })).status).toBe(401);
  });

  test('un code de secours marche une seule fois', async () => {
    const agent = request.agent(app);
    await connexion(agent);
    expect((await agent.post('/api/auth/login/code').send({ code: codesSecours[0].toLowerCase() })).status).toBe(200);

    const encore = request.agent(app);
    await connexion(encore);
    expect((await encore.post('/api/auth/login/code').send({ code: codesSecours[0] })).status).toBe(401);
  });

  test('5 mauvais codes bloquent le compte 15 minutes, même avec le bon code', async () => {
    await pool.query('UPDATE app_user SET totp_echecs = 0, totp_bloque_jusqua = NULL WHERE id = $1', [ids[AGENT]]);
    const agent = request.agent(app);
    await connexion(agent);
    const statuts = [];
    for (let i = 0; i < 5; i += 1) statuts.push((await agent.post('/api/auth/login/code').send({ code: '111111' })).status);
    expect(statuts.slice(0, 4)).toEqual([401, 401, 401, 401]);
    expect(statuts[4]).toBe(429);
    const bloque = await agent.post('/api/auth/login/code').send({ code: codesSecours[1] });
    expect(bloque.status).toBe(429);
    await pool.query('UPDATE app_user SET totp_echecs = 0, totp_bloque_jusqua = NULL WHERE id = $1', [ids[AGENT]]);
  });

  test('un policier ne peut pas réinitialiser la double authentification d\'un autre compte', async () => {
    const res = await request(app).post(`/api/users/${ids[AGENT]}/2fa/reinitialiser`).set('Authorization', bearer(AGENT, 'policier'));
    expect(res.status).toBe(403);
  });

  test('la direction ne réinitialise pas son propre compte', async () => {
    const res = await request(app).post(`/api/users/${ids[DIRECTION]}/2fa/reinitialiser`).set('Authorization', bearer(DIRECTION, 'direction'));
    expect(res.status).toBe(403);
  });

  test('désactiver exige le mot de passe ET un code valide', async () => {
    const auth = bearer(AGENT, 'policier');
    const sansMdp = await request(app).post('/api/auth/2fa/desactiver').set('Authorization', auth).send({ mot_de_passe: 'faux', code: codesSecours[2] });
    expect(sansMdp.status).toBe(400);
    const ok = await request(app).post('/api/auth/2fa/desactiver').set('Authorization', auth).send({ mot_de_passe: MOT_DE_PASSE, code: codesSecours[3] });
    expect(ok.status).toBe(200);
    expect(ok.body.user.totp_active).toBe(false);

    // Sans double authentification, le mot de passe suffit de nouveau
    const res = await connexion(request.agent(app));
    expect(res.body.deuxFacteurs).toBeUndefined();
    expect(aUneSession(res)).toBe(true);
  });

  test('la direction réinitialise la double authentification d\'un agent, et c\'est journalisé', async () => {
    const auth = bearer(AGENT, 'policier');
    const prep = await request(app).post('/api/auth/2fa/preparer').set('Authorization', auth);
    await request(app).post('/api/auth/2fa/activer').set('Authorization', auth).send({ code: codePourPas(prep.body.secret, pasActuel()) });

    const res = await request(app).post(`/api/users/${ids[AGENT]}/2fa/reinitialiser`).set('Authorization', bearer(DIRECTION, 'direction'));
    expect(res.status).toBe(200);
    const { rows } = await pool.query('SELECT totp_active, totp_secret FROM app_user WHERE id = $1', [ids[AGENT]]);
    expect(rows[0]).toEqual({ totp_active: false, totp_secret: null });
    const journal = await pool.query("SELECT 1 FROM audit_log WHERE action = 'TOTP_RESET' AND target_id = $1", [ids[AGENT]]);
    expect(journal.rowCount).toBe(1);
  });
});
