/**
 * Tests des routes /api/criminals avec Supertest.
 * La base de données est simulée : aucun PostgreSQL requis.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret';

const query = jest.fn();
jest.unstable_mockModule('../../src/config/db.js', () => ({
  pool: { query },
  initializeDatabase: jest.fn(),
  closeDatabase: jest.fn(),
  withTransaction: jest.fn(),
}));

const emitEvent = jest.fn();
jest.unstable_mockModule('../../src/sockets/index.js', () => ({
  default: jest.fn(),
  emitEvent,
}));

const { default: app } = await import('../../src/app.js');

const bearer = (role = 'policier') =>
  `Bearer ${jwt.sign({ id: 7, badge_number: 'PL-007', role, grade: 'sergent_autres_fonctions' }, 'test-secret')}`;

const dossier = { id: 1, first_name: 'Jean', last_name: 'Dupont', status: 'recherche', version: 1 };

beforeEach(() => {
  query.mockReset();
  emitEvent.mockReset();
});

describe('authentification requise', () => {
  test('401 sans jeton', async () => {
    const res = await request(app).get('/api/criminals');

    expect(res.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  test('403 avec un jeton invalide', async () => {
    const res = await request(app).get('/api/criminals').set('Authorization', 'Bearer faux');

    expect(res.status).toBe(403);
  });
});

describe('GET /api/criminals', () => {
  // findAll puis countAll sont lancés en parallèle
  const mockList = (rows, count) =>
    query.mockImplementation(async (sql) =>
      sql.includes('COUNT(*)') ? { rows: [{ count: String(count) }] } : { rows });

  test('200 avec la page 1 et 10 résultats par défaut', async () => {
    mockList([dossier], 1);

    const res = await request(app).get('/api/criminals').set('Authorization', bearer());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1, data: [dossier] });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY c\.added_at DESC/);
    expect(params).toEqual([10, 0]); // LIMIT 10 OFFSET 0
  });

  test('calcule l\'OFFSET et le nombre de pages', async () => {
    mockList([], 12);

    const res = await request(app).get('/api/criminals?page=3&limit=5').set('Authorization', bearer());

    expect(res.body).toMatchObject({ page: 3, limit: 5, total: 12, totalPages: 3 });
    expect(query.mock.calls[0][1]).toEqual([5, 10]);
  });

  test('revient aux valeurs par défaut si page / limit ne sont pas des nombres', async () => {
    mockList([], 0);

    const res = await request(app).get('/api/criminals?page=abc&limit=xyz').set('Authorization', bearer());

    expect(res.body.page).toBe(1);
    expect(query.mock.calls[0][1]).toEqual([10, 0]);
  });

  test('filtre par statut', async () => {
    mockList([dossier], 1);

    await request(app).get('/api/criminals?status=capture').set('Authorization', bearer());

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/WHERE c\.status = \$1/);
    expect(params).toEqual(['capture', 10, 0]);
  });

  test('recherche par nom (q), sur la liste ET le comptage', async () => {
    mockList([dossier], 1);

    const res = await request(app).get('/api/criminals?q=%20dupont%20').set('Authorization', bearer());

    expect(res.status).toBe(200);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/ILIKE \$1/);
    expect(params).toEqual(['%dupont%', 10, 0]); // espaces autour retirés
    const [sqlCount, paramsCount] = query.mock.calls[1];
    expect(sqlCount).toMatch(/COUNT\(\*\).*ILIKE \$1/s);
    expect(paramsCount).toEqual(['%dupont%']);
  });

  test('combine le statut et la recherche', async () => {
    mockList([], 0);

    await request(app).get('/api/criminals?status=recherche&q=Jean').set('Authorization', bearer());

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/c\.status = \$1 AND .*ILIKE \$2/s);
    expect(params).toEqual(['recherche', '%Jean%', 10, 0]);
  });

  test('les jokers % et _ tapés par l\'agent sont cherchés tels quels', async () => {
    mockList([], 0);

    await request(app).get('/api/criminals?q=50%25_').set('Authorization', bearer());

    expect(query.mock.calls[0][1][0]).toBe('%50\\%\\_%');
  });

  test('une recherche vide est ignorée', async () => {
    mockList([], 0);

    await request(app).get('/api/criminals?q=%20%20').set('Authorization', bearer());

    expect(query.mock.calls[0][0]).not.toMatch(/ILIKE/);
    expect(query.mock.calls[0][1]).toEqual([10, 0]);
  });

  test('limite bornée entre 1 et 100, page au moins 1', async () => {
    mockList([], 0);

    const res = await request(app).get('/api/criminals?page=-2&limit=5000').set('Authorization', bearer());

    expect(res.body).toMatchObject({ page: 1, limit: 100 });
    expect(query.mock.calls[0][1]).toEqual([100, 0]);
  });

  test('400 si le statut filtré est inconnu', async () => {
    const res = await request(app).get('/api/criminals?status=INCONNU').set('Authorization', bearer());

    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  test('500 si la base de données plante', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    query.mockRejectedValue(new Error('DB down'));

    const res = await request(app).get('/api/criminals').set('Authorization', bearer());

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Erreur serveur');
    spy.mockRestore();
  });
});

describe('GET /api/criminals/:id', () => {
  test('200 avec le dossier', async () => {
    query.mockResolvedValue({ rows: [dossier] });

    const res = await request(app).get('/api/criminals/1').set('Authorization', bearer());

    expect(res.status).toBe(200);
    expect(res.body).toEqual(dossier);
  });

  test('404 si le dossier n\'existe pas', async () => {
    query.mockResolvedValue({ rows: [] });

    const res = await request(app).get('/api/criminals/999').set('Authorization', bearer());

    expect(res.status).toBe(404);
  });
});

describe('POST /api/criminals', () => {
  test('201 : crée le dossier au nom de l\'agent et diffuse criminal:added', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // INSERT
      .mockResolvedValueOnce({ rows: [dossier] }); // findById

    const res = await request(app)
      .post('/api/criminals')
      .set('Authorization', bearer())
      .send({ first_name: 'Jean', last_name: 'Dupont' });

    expect(res.status).toBe(201);
    expect(res.body.criminal).toEqual(dossier);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO criminal/);
    expect(params[6]).toBe('recherche'); // statut par défaut
    expect(params[8]).toBe(7); // added_by = agent du jeton
    expect(emitEvent).toHaveBeenCalledWith('criminal:added', dossier);
  });

  test('400 si le prénom ou le nom manque', async () => {
    const res = await request(app)
      .post('/api/criminals')
      .set('Authorization', bearer())
      .send({ first_name: 'Jean' });

    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  test('400 si le statut est inconnu', async () => {
    const res = await request(app)
      .post('/api/criminals')
      .set('Authorization', bearer())
      .send({ first_name: 'Jean', last_name: 'Dupont', status: 'WANTED' });

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/criminals/:id', () => {
  const body = { first_name: 'Jean', last_name: 'Dupont', description: 'Modifié' };

  test('403 pour un policier', async () => {
    const res = await request(app).put('/api/criminals/1').set('Authorization', bearer()).send(body);

    expect(res.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  test('200 pour un superviseur et diffuse criminal:updated', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [dossier] });

    const res = await request(app).put('/api/criminals/1').set('Authorization', bearer('superviseur')).send(body);

    expect(res.status).toBe(200);
    expect(query.mock.calls[0][1][7]).toBe(7); // updated_by
    expect(emitEvent).toHaveBeenCalledWith('criminal:updated', dossier);
  });

  test('404 si le dossier n\'existe pas', async () => {
    query.mockResolvedValue({ rows: [] });

    const res = await request(app).put('/api/criminals/999').set('Authorization', bearer('direction')).send(body);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/criminals/:id/status', () => {
  const url = '/api/criminals/1/status';

  test('400 sans statut', async () => {
    const res = await request(app).patch(url).set('Authorization', bearer()).send({ version: 1 });

    expect(res.status).toBe(400);
  });

  test('400 avec un statut hors ENUM', async () => {
    const res = await request(app).patch(url).set('Authorization', bearer()).send({ status: 'EN_PRISON', version: 1 });

    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  test('400 sans version', async () => {
    const res = await request(app).patch(url).set('Authorization', bearer()).send({ status: 'capture' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/version/);
  });

  test('200 si la version correspond', async () => {
    const capture = { ...dossier, status: 'capture', version: 2 };
    query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [capture] });

    const res = await request(app).patch(url).set('Authorization', bearer()).send({ status: 'capture', version: 1 });

    expect(res.status).toBe(200);
    expect(res.body.criminal).toEqual(capture);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$3 AND version = \$4/);
    expect(params).toEqual(['capture', 7, '1', 1]);
    expect(emitEvent).toHaveBeenCalledWith('criminal:updated', capture);
  });

  test('409 avec l\'état courant si la version est périmée', async () => {
    const current = { ...dossier, status: 'capture', version: 2 };
    query
      .mockResolvedValueOnce({ rows: [] }) // UPDATE : aucune ligne
      .mockResolvedValueOnce({ rows: [current] }); // le dossier existe

    const res = await request(app).patch(url).set('Authorization', bearer()).send({ status: 'libere', version: 1 });

    expect(res.status).toBe(409);
    expect(res.body.criminal).toEqual(current);
    expect(emitEvent).not.toHaveBeenCalled();
  });

  test('404 si le dossier n\'existe pas', async () => {
    query.mockResolvedValue({ rows: [] });

    const res = await request(app).patch(url).set('Authorization', bearer()).send({ status: 'libere', version: 1 });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/criminals/:id', () => {
  test('403 pour un policier', async () => {
    const res = await request(app).delete('/api/criminals/1').set('Authorization', bearer());

    expect(res.status).toBe(403);
  });

  test('200 pour un superviseur : journalise et diffuse criminal:removed', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // DELETE
      .mockResolvedValueOnce({ rows: [{ id: 99 }] }); // audit_log

    const res = await request(app).delete('/api/criminals/1').set('Authorization', bearer('superviseur'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Dossier retiré avec succès', id: 1 });
    const [sql, params] = query.mock.calls[1];
    expect(sql).toMatch(/INSERT INTO audit_log/);
    expect(params.slice(0, 4)).toEqual([7, 'CRIMINAL_REMOVED', 'criminal', 1]);
    expect(emitEvent).toHaveBeenCalledWith('criminal:removed', { id: 1 });
  });

  test('404 si le dossier n\'existe pas', async () => {
    query.mockResolvedValue({ rows: [] });

    const res = await request(app).delete('/api/criminals/999').set('Authorization', bearer('direction'));

    expect(res.status).toBe(404);
  });
});
