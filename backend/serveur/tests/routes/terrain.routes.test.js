/**
 * Tests des routes /api/sightings, /api/alerts et /api/audit-logs avec Supertest.
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
  emitToUsers: jest.fn(),
}));

const { default: app } = await import('../../src/app.js');

const bearer = (role) =>
  `Bearer ${jwt.sign({ id: 3, badge_number: 'PL-003', role, grade: 'sergent_autres_fonctions' }, 'test-secret')}`;

beforeEach(() => {
  query.mockReset();
  emitEvent.mockReset();
});

describe('/api/sightings', () => {
  test('POST 201 : signale une observation au nom de l\'agent', async () => {
    const sighting = { id: 4, criminal_id: 1, location: 'Montréal', reported_by: 'Marc Roy' };
    query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // le dossier existe
      .mockResolvedValueOnce({ rows: [{ id: 4 }] }) // INSERT
      .mockResolvedValueOnce({ rows: [sighting] }); // findById

    const res = await request(app)
      .post('/api/sightings')
      .set('Authorization', bearer('policier'))
      .send({ criminal_id: 1, location: 'Montréal', notes: 'Vu au métro' });

    expect(res.status).toBe(201);
    expect(res.body.sighting).toEqual(sighting);
    expect(query.mock.calls[1][1]).toEqual([1, 3, 'Montréal', 'Vu au métro', null, null]);
    expect(emitEvent).toHaveBeenCalledWith('sighting:added', sighting);
  });

  test('POST 400 sans lieu', async () => {
    const res = await request(app)
      .post('/api/sightings')
      .set('Authorization', bearer('policier'))
      .send({ criminal_id: 1 });

    expect(res.status).toBe(400);
  });

  test('POST 201 : enregistre la position du signalement (carte)', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 5 }] })
      .mockResolvedValueOnce({ rows: [{ id: 5 }] });

    const res = await request(app)
      .post('/api/sightings')
      .set('Authorization', bearer('policier'))
      .send({ criminal_id: 1, location: 'Vieux-Port', latitude: '45.5075', longitude: -73.5536 });

    expect(res.status).toBe(201);
    expect(query.mock.calls[1][1]).toEqual([1, 3, 'Vieux-Port', undefined, 45.5075, -73.5536]);
  });

  test.each([
    ['latitude seule', { latitude: 45.5 }],
    ['latitude hors bornes', { latitude: 91, longitude: -73.5 }],
    ['longitude non numérique', { latitude: 45.5, longitude: 'ouest' }],
  ])('POST 400 si la position est invalide (%s)', async (_, position) => {
    const res = await request(app)
      .post('/api/sightings')
      .set('Authorization', bearer('policier'))
      .send({ criminal_id: 1, location: 'Montréal', ...position });

    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  test('GET /recent : derniers signalements pour tout agent, limite bornée', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 4, latitude: 45.5, longitude: -73.5 }] });

    const res = await request(app).get('/api/sightings/recent?limit=9999').set('Authorization', bearer('policier'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 4, latitude: 45.5, longitude: -73.5 }]);
    expect(query.mock.calls[0][1]).toEqual([500]);
  });

  test('POST 404 si le dossier n\'existe pas', async () => {
    query.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .post('/api/sightings')
      .set('Authorization', bearer('policier'))
      .send({ criminal_id: 999, location: 'Laval' });

    expect(res.status).toBe(404);
  });

  test('GET est réservé aux superviseurs', async () => {
    const res = await request(app).get('/api/sightings?criminal_id=1').set('Authorization', bearer('policier'));

    expect(res.status).toBe(403);
  });

  test('GET 400 sans criminal_id', async () => {
    const res = await request(app).get('/api/sightings').set('Authorization', bearer('superviseur'));

    expect(res.status).toBe(400);
  });

  test('GET 200 renvoie l\'historique du dossier', async () => {
    query.mockResolvedValue({ rows: [{ id: 4 }] });

    const res = await request(app).get('/api/sightings?criminal_id=1').set('Authorization', bearer('superviseur'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 4 }]);
  });
});

describe('/api/alerts', () => {
  test('POST est réservé aux superviseurs', async () => {
    const res = await request(app)
      .post('/api/alerts')
      .set('Authorization', bearer('policier'))
      .send({ message: 'Alerte' });

    expect(res.status).toBe(403);
  });

  test('POST 201 : enregistre, journalise et diffuse alert:broadcast', async () => {
    const alert = { id: 8, message: 'Individu dangereux', severity: 'urgent' };
    query
      .mockResolvedValueOnce({ rows: [{ id: 8 }] }) // INSERT
      .mockResolvedValueOnce({ rows: [alert] }) // findById
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // audit_log

    const res = await request(app)
      .post('/api/alerts')
      .set('Authorization', bearer('superviseur'))
      .send({ message: 'Individu dangereux', severity: 'urgent' });

    expect(res.status).toBe(201);
    expect(query.mock.calls[2][1][1]).toBe('ALERT_ISSUED');
    expect(emitEvent).toHaveBeenCalledWith('alert:broadcast', alert);
  });

  test('POST 400 si la sévérité est inconnue', async () => {
    const res = await request(app)
      .post('/api/alerts')
      .set('Authorization', bearer('direction'))
      .send({ message: 'Alerte', severity: 'critique' });

    expect(res.status).toBe(400);
  });

  test('GET 200 : liste paginée pour tout agent connecté', async () => {
    query.mockResolvedValue({ rows: [] });

    const res = await request(app).get('/api/alerts?page=2').set('Authorization', bearer('policier'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ page: 2, limit: 20, data: [] });
    expect(query.mock.calls[0][1]).toEqual([20, 20]);
  });
});

describe('/api/audit-logs', () => {
  test('403 pour un superviseur', async () => {
    const res = await request(app).get('/api/audit-logs').set('Authorization', bearer('superviseur'));

    expect(res.status).toBe(403);
  });

  test('200 pour la direction, avec le total', async () => {
    query.mockImplementation(async (sql) =>
      sql.includes('COUNT(*)') ? { rows: [{ count: '41' }] } : { rows: [{ id: 1 }] });

    const res = await request(app).get('/api/audit-logs').set('Authorization', bearer('direction'));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, limit: 20, total: 41, totalPages: 3 });
  });
});
