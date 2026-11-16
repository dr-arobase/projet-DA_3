/**
 * Modifier, retirer et remettre une alerte (#220), avec la VRAIE base PostgreSQL :
 * la migration (edited_*, archived_*), les requêtes du modèle et la règle « auteur ou direction ».
 * Retirer = archiver : la ligne reste en base. Si la base n'est pas joignable, ces tests sont ignorés.
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

process.env.JWT_SECRET ??= 'test-secret';

const { pool, initializeDatabase, closeDatabase } = await import('../../src/config/db.js');
const { default: app } = await import('../../src/app.js');
const { signToken } = await import('../../src/utils/jwt.js');

const dbAvailable = await pool.query('SELECT 1').then(() => true, () => false);
const describeDb = dbAvailable ? describe : describe.skip;

// L'auteur (policier), un autre policier et la direction
const AGENTS = {
  auteur: { badge: 'TEST-RETRAIT-A', role: 'policier', grade: 'sergent_autres_fonctions', prenom: 'Auteur' },
  autre: { badge: 'TEST-RETRAIT-B', role: 'policier', grade: 'sergent_autres_fonctions', prenom: 'Autre' },
  direction: { badge: 'TEST-RETRAIT-D', role: 'direction', grade: 'directeur_general', prenom: 'Direction' },
};
const BADGES = Object.values(AGENTS).map((a) => a.badge);
const DES_AGENTS = 'IN (SELECT id FROM app_user WHERE badge_number = ANY($1))';

async function cleanUp() {
  await pool.query(`DELETE FROM audit_log WHERE actor_id ${DES_AGENTS}`, [BADGES]);
  await pool.query(`DELETE FROM alert WHERE issued_by ${DES_AGENTS}`, [BADGES]);
  await pool.query('DELETE FROM app_user WHERE badge_number = ANY($1)', [BADGES]);
}

const appel = (qui, method, url, body) => {
  const a = AGENTS[qui];
  const req = request(app)[method](url)
    .set('Authorization', `Bearer ${signToken({ id: a.id, badge_number: a.badge, role: a.role, grade: a.grade })}`);
  return body ? req.send(body) : req;
};
const idsDe = (res) => res.body.data.map((x) => x.id);

beforeAll(async () => {
  if (!dbAvailable) return;
  await initializeDatabase();
  await cleanUp();
  for (const a of Object.values(AGENTS)) {
    const { rows } = await pool.query(
      `INSERT INTO app_user (first_name, last_name, badge_number, email, password_hash, role, grade)
       VALUES ($1, 'Essai', $2, $3, 'x', $4, $5) RETURNING id`,
      [a.prenom, a.badge, `${a.badge.toLowerCase()}@crimetracker.local`, a.role, a.grade]
    );
    a.id = rows[0].id;
  }
});

afterAll(async () => {
  if (dbAvailable) await cleanUp();
  await closeDatabase();
});

describeDb('Modifier, retirer et remettre une diffusion (#220)', () => {
  test('la migration a ajouté les colonnes de modification et d\'archivage', async () => {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'alert' AND column_name IN ('edited_at', 'edited_by', 'archived_at', 'archived_by')
       ORDER BY column_name`
    );
    expect(rows.map((r) => r.column_name)).toEqual(['archived_at', 'archived_by', 'edited_at', 'edited_by']);
  });

  test('parcours complet : modifier, retirer, archives, remettre, avec les refus et le journal', async () => {
    const creee = await appel('auteur', 'post', '/api/alerts', { message: 'Suspect armé', severity: 'urgent' });
    expect(creee.status).toBe(201);
    const id = creee.body.alert.id;
    expect(creee.body.alert.issued_by_id).toBe(AGENTS.auteur.id);

    // Un autre policier ne peut ni modifier ni retirer
    expect((await appel('autre', 'patch', `/api/alerts/${id}`, { message: 'Piraté' })).status).toBe(403);
    expect((await appel('autre', 'post', `/api/alerts/${id}/archive`)).status).toBe(403);

    // L'auteur modifie : mention « modifié le … par … »
    const modifiee = await appel('auteur', 'patch', `/api/alerts/${id}`, { message: 'Suspect armé, direction est' });
    expect(modifiee.status).toBe(200);
    expect(modifiee.body.alert).toMatchObject({ message: 'Suspect armé, direction est', edited_by: 'Auteur Essai' });
    expect(modifiee.body.alert.edited_at).not.toBeNull();

    // L'auteur retire : la diffusion quitte la liste, va dans les archives, et la ligne reste en base
    const retiree = await appel('auteur', 'post', `/api/alerts/${id}/archive`);
    expect(retiree.status).toBe(200);
    expect(retiree.body.alert.archived_by).toBe('Auteur Essai');
    expect(idsDe(await appel('autre', 'get', '/api/alerts?severity=urgent&limit=100'))).not.toContain(id);
    expect(idsDe(await appel('autre', 'get', '/api/alerts?archived=true&limit=100'))).toContain(id);
    const { rowCount } = await pool.query('SELECT 1 FROM alert WHERE id = $1', [id]);
    expect(rowCount).toBe(1);
    expect((await appel('auteur', 'patch', `/api/alerts/${id}`, { message: 'Trop tard' })).status).toBe(409);

    // Seuls l'auteur ou la direction la remettent
    expect((await appel('autre', 'post', `/api/alerts/${id}/restore`)).status).toBe(403);
    const remise = await appel('direction', 'post', `/api/alerts/${id}/restore`);
    expect(remise.status).toBe(200);
    expect(remise.body.alert).toMatchObject({ archived_at: null, archived_by: null, message: 'Suspect armé, direction est' });
    expect(idsDe(await appel('autre', 'get', '/api/alerts?severity=urgent&limit=100'))).toContain(id);

    // Journal d'audit : création, modification, retrait et remise, par le bon agent
    const { rows } = await pool.query(
      'SELECT actor_id, action FROM audit_log WHERE target_type = $1 AND target_id = $2 ORDER BY id',
      ['alert', id]
    );
    expect(rows).toEqual([
      { actor_id: AGENTS.auteur.id, action: 'ALERT_ISSUED' },
      { actor_id: AGENTS.auteur.id, action: 'ALERT_EDITED' },
      { actor_id: AGENTS.auteur.id, action: 'ALERT_ARCHIVED' },
      { actor_id: AGENTS.direction.id, action: 'ALERT_RESTORED' },
    ]);
  });
});
