// Récits #2 à #7 — le registre des personnes recherchées (tickets #4 à #9)
import request from 'supertest';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { loginAs, resetDatabase } from './helpers.js';

let policier;
let superviseur;
let direction;

beforeAll(async () => {
  await resetDatabase();
  [policier, superviseur, direction] = await Promise.all([loginAs('PL-003'), loginAs('SM-002'), loginAs('PO-001')]);
});
afterAll(() => pool.end());

const newCriminal = (overrides = {}) => ({
  first_name: 'Test',
  last_name: 'Nouveau',
  date_of_birth: '1991-03-04',
  nationality: 'Canadienne',
  photo_url: 'https://exemple.org/photo.jpg',
  description: 'Casquette bleue',
  crimes: 'Vol',
  ...overrides,
});

describe('accès sans être connecté', () => {
  test.each([
    ['get', '/api/criminals'],
    ['get', '/api/criminals/1'],
    ['post', '/api/criminals'],
    ['patch', '/api/criminals/1'],
    ['delete', '/api/criminals/1'],
  ])('%s %s : 401', async (method, path) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
  });
});

describe('#2 — liste paginée (GET /api/criminals)', () => {
  test('première page : 10 dossiers, total et nombre de pages', async () => {
    const res = await policier.get('/api/criminals');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, limit: 10, total: 12, totalPages: 2 });
    expect(res.body.data).toHaveLength(10);
    expect(Object.keys(res.body.data[0])).toEqual(
      expect.arrayContaining(['id', 'first_name', 'last_name', 'status', 'photo_url']));
  });

  test('deuxième page : les 2 dossiers restants, sans doublon', async () => {
    const page1 = await policier.get('/api/criminals?page=1');
    const page2 = await policier.get('/api/criminals?page=2');
    expect(page2.body.data).toHaveLength(2);
    const ids = [...page1.body.data, ...page2.body.data].map((c) => c.id);
    expect(new Set(ids).size).toBe(12);
  });

  test('taille de page choisie, plafonnée à 50', async () => {
    expect((await policier.get('/api/criminals?limit=5')).body.data).toHaveLength(5);
    expect((await policier.get('/api/criminals?limit=500')).body.limit).toBe(50);
  });
});

describe('#7 — recherche et filtre', () => {
  test('recherche par nom, insensible à la casse', async () => {
    const res = await policier.get('/api/criminals?q=dupont');
    expect(res.body.total).toBe(1);
    expect(res.body.data[0]).toMatchObject({ first_name: 'Jean', last_name: 'Dupont' });
  });

  test('recherche par prénom et nom complets', async () => {
    expect((await policier.get('/api/criminals?q=Jean%20Dupont')).body.total).toBe(1);
  });

  test('filtre par statut', async () => {
    const res = await policier.get('/api/criminals?status=capture');
    expect(res.body.total).toBe(2);
    expect(res.body.data.every((c) => c.status === 'capture')).toBe(true);
  });

  test('recherche et statut combinés', async () => {
    expect((await policier.get('/api/criminals?q=moreau&status=capture')).body.total).toBe(1);
    expect((await policier.get('/api/criminals?q=moreau&status=recherche')).body.total).toBe(0);
  });

  test('aucun résultat : liste vide et total 0', async () => {
    const res = await policier.get('/api/criminals?q=inexistant');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 0, data: [] });
  });

  test('les caractères spéciaux de LIKE et SQL sont cherchés tels quels', async () => {
    expect((await policier.get('/api/criminals?q=%25')).body.total).toBe(0);
    expect((await policier.get("/api/criminals?q=' OR 1=1 --")).body.total).toBe(0);
  });

  test('statut inconnu : 400', async () => {
    expect((await policier.get('/api/criminals?status=evade')).status).toBe(400);
  });
});

describe('#3 — profil complet (GET /api/criminals/:id)', () => {
  test('identité, crimes, statut, auteur et historique des statuts', async () => {
    const res = await policier.get('/api/criminals/1');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 1,
      first_name: 'Jean',
      last_name: 'Dupont',
      date_of_birth: '1985-04-12',
      nationality: 'Canadienne',
      crimes: 'Vol qualifié',
      status: 'recherche',
      version: 1,
      added_by_name: 'Chrysler Jean',
    });
    expect(res.body.status_history).toEqual([
      expect.objectContaining({ status: 'recherche', changed_by_name: 'Chrysler Jean' }),
    ]);
  });

  test('identifiant inexistant : 404 avec un message', async () => {
    const res = await policier.get('/api/criminals/99999');
    expect(res.status).toBe(404);
    expect(res.body.message).toBeTruthy();
  });

  test.each(['abc', '0', '-3', '1.5'])('identifiant invalide %p : 400', async (id) => {
    expect((await policier.get(`/api/criminals/${id}`)).status).toBe(400);
  });
});

describe('#4 — ajout d\'un dossier (POST /api/criminals)', () => {
  test('201 : créé au statut « recherche », par le compte connecté, visible en tête de liste', async () => {
    const res = await policier.post('/api/criminals').send(newCriminal({ last_name: 'Ajouté' }));
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/criminals/${res.body.criminal.id}`);
    expect(res.body.criminal).toMatchObject({ last_name: 'Ajouté', status: 'recherche', added_by: 3, version: 1 });

    const list = await superviseur.get('/api/criminals');
    expect(list.body.data[0].id).toBe(res.body.criminal.id);

    const detail = await policier.get(`/api/criminals/${res.body.criminal.id}`);
    expect(detail.body.status_history).toHaveLength(1);
  });

  test('ignore added_by et status envoyés par le client', async () => {
    const res = await policier.post('/api/criminals').send(newCriminal({ added_by: 1, status: 'libere' }));
    expect(res.body.criminal).toMatchObject({ added_by: 3, status: 'recherche' });
  });

  test('champs requis manquants : 400, une erreur par champ, rien n\'est inséré', async () => {
    const before = (await policier.get('/api/criminals')).body.total;
    const res = await policier.post('/api/criminals').send({ first_name: ' ', nationality: 'X' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors)).toEqual(expect.arrayContaining(['first_name', 'last_name', 'crimes']));
    expect((await policier.get('/api/criminals')).body.total).toBe(before);
  });

  test('valeurs invalides (date, photo) : 400', async () => {
    const res = await policier.post('/api/criminals').send(newCriminal({ date_of_birth: '1990-13-45', photo_url: 'javascript:alert(1)' }));
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors)).toEqual(['date_of_birth', 'photo_url']);
  });

  test('le texte est enregistré tel quel (pas d\'injection SQL)', async () => {
    const name = "Robert'); DROP TABLE criminal;--";
    const res = await policier.post('/api/criminals').send(newCriminal({ first_name: name }));
    expect(res.status).toBe(201);
    expect((await policier.get(`/api/criminals/${res.body.criminal.id}`)).body.first_name).toBe(name);
  });
});

describe('#6 — changement de statut (PATCH /api/criminals/:id)', () => {
  let id;
  beforeEach(async () => {
    id = (await policier.post('/api/criminals').send(newCriminal())).body.criminal.id;
  });

  test('200 : statut changé, version incrémentée, auteur et date enregistrés, historique allongé', async () => {
    const res = await policier.patch(`/api/criminals/${id}`).send({ status: 'capture', version: 1 });
    expect(res.status).toBe(200);
    expect(res.body.criminal).toMatchObject({ status: 'capture', version: 2, updated_by: 3 });

    const detail = await policier.get(`/api/criminals/${id}`);
    expect(detail.body.updated_by_name).toBe('Chrysler Jean');
    expect(detail.body.status_history.map((h) => h.status)).toEqual(['capture', 'recherche']);
    expect(new Date(detail.body.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(detail.body.added_at).getTime());
  });

  test('version périmée : 409 avec l\'état actuel, rien n\'est modifié', async () => {
    await superviseur.patch(`/api/criminals/${id}`).send({ status: 'capture', version: 1 });
    const res = await policier.patch(`/api/criminals/${id}`).send({ status: 'libere', version: 1 });

    expect(res.status).toBe(409);
    expect(res.body.current).toEqual({ status: 'capture', version: 2 });
    expect((await policier.get(`/api/criminals/${id}`)).body.status).toBe('capture');
  });

  test('deux mises à jour simultanées sur la même version : une seule réussit', async () => {
    const results = await Promise.all([
      policier.patch(`/api/criminals/${id}`).send({ status: 'capture', version: 1 }),
      superviseur.patch(`/api/criminals/${id}`).send({ status: 'libere', version: 1 }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await policier.get(`/api/criminals/${id}`)).body.status_history).toHaveLength(2);
  });

  test('statut inconnu ou version absente : 400', async () => {
    expect((await policier.patch(`/api/criminals/${id}`).send({ status: 'WANTED', version: 1 })).status).toBe(400);
    expect((await policier.patch(`/api/criminals/${id}`).send({ status: 'capture' })).status).toBe(400);
  });

  test('même statut qu\'avant : 400', async () => {
    expect((await policier.patch(`/api/criminals/${id}`).send({ status: 'recherche', version: 1 })).status).toBe(400);
  });

  test('dossier inexistant : 404', async () => {
    expect((await policier.patch('/api/criminals/99999').send({ status: 'capture', version: 1 })).status).toBe(404);
  });
});

describe('#5 — retrait d\'un dossier (DELETE /api/criminals/:id)', () => {
  let id;
  beforeEach(async () => {
    id = (await policier.post('/api/criminals').send(newCriminal({ last_name: 'ARetirer' }))).body.criminal.id;
  });

  test('un policier est refusé (403) et le dossier reste', async () => {
    const res = await policier.delete(`/api/criminals/${id}`);
    expect(res.status).toBe(403);
    expect((await policier.get(`/api/criminals/${id}`)).status).toBe(200);
  });

  test('un superviseur retire le dossier : 204, il disparaît pour tous, l\'action est au journal d\'audit', async () => {
    const res = await superviseur.delete(`/api/criminals/${id}`);
    expect(res.status).toBe(204);
    expect((await policier.get(`/api/criminals/${id}`)).status).toBe(404);
    const remaining = (await policier.get('/api/criminals?q=ARetirer&limit=50')).body.data;
    expect(remaining.map((c) => c.id)).not.toContain(id);

    const { rows } = await pool.query(
      "SELECT actor_id, action FROM audit_log WHERE target_type = 'criminal' AND target_id = $1", [id]);
    expect(rows).toEqual([{ actor_id: 2, action: 'criminal.remove' }]);
  });

  test('la direction peut aussi retirer un dossier', async () => {
    expect((await direction.delete(`/api/criminals/${id}`)).status).toBe(204);
  });

  test('dossier inexistant : 404', async () => {
    expect((await superviseur.delete('/api/criminals/99999')).status).toBe(404);
  });
});
