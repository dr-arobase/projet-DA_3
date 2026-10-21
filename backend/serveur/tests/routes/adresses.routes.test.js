/**
 * Adresses (#64, #65) : dernière adresse connue d'un dossier et route de géocodage.
 * La base et Nominatim sont simulés : aucun PostgreSQL ni réseau requis.
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
const disconnectUser = jest.fn();
jest.unstable_mockModule('../../src/sockets/index.js', () => ({
  default: jest.fn(),
  emitEvent,
  emitToUsers: jest.fn(),
  disconnectUser,
}));

const geocode = jest.fn();
const geocodeOrNull = jest.fn();
jest.unstable_mockModule('../../src/services/geocoding.service.js', () => ({ geocode, geocodeOrNull }));

jest.unstable_mockModule('../../src/utils/account-status.js', () => ({
  isAccountActive: jest.fn(async () => true),
  publishAccountDeactivated: jest.fn(),
  listenForAccountDeactivations: jest.fn(),
}));

const { default: app } = await import('../../src/app.js');

const bearer = `Bearer ${jwt.sign({ id: 3, badge_number: 'PL-003', role: 'policier' }, 'test-secret')}`;
const BERRI = { latitude: 45.5153, longitude: -73.561, display_name: 'Berri-UQAM, Montréal' };

beforeEach(() => {
  query.mockReset();
  emitEvent.mockReset();
  geocode.mockReset();
  geocodeOrNull.mockReset();
});

describe('POST /api/criminals avec une adresse', () => {
  const dossier = (extra = {}) => ({ id: 5, first_name: 'Jean', last_name: 'Tremblay', ...extra });
  const creer = (corps) => request(app).post('/api/criminals').set('Authorization', bearer).send(corps);

  test('l\'adresse est convertie en position et enregistrée avec le dossier', async () => {
    geocodeOrNull.mockResolvedValue(BERRI);
    const cree = dossier({ last_known_address: '505 rue Sainte-Catherine Est, Montréal', ...BERRI });
    query.mockResolvedValueOnce({ rows: [{ id: 5 }] }).mockResolvedValueOnce({ rows: [cree] });

    const res = await creer({ first_name: 'Jean', last_name: 'Tremblay', last_known_address: '  505 rue Sainte-Catherine Est, Montréal ' });

    expect(res.status).toBe(201);
    expect(geocodeOrNull).toHaveBeenCalledWith('505 rue Sainte-Catherine Est, Montréal');
    // $10 à $12 : adresse nettoyée, latitude, longitude
    expect(query.mock.calls[0][1].slice(9)).toEqual(['505 rue Sainte-Catherine Est, Montréal', 45.5153, -73.561]);
    expect(res.body.warning).toBeUndefined();
  });

  test('adresse introuvable : le dossier est quand même créé, sans position, avec un avertissement', async () => {
    geocodeOrNull.mockResolvedValue(null);
    query
      .mockResolvedValueOnce({ rows: [{ id: 5 }] })
      .mockResolvedValueOnce({ rows: [dossier({ last_known_address: 'Nulle part', latitude: null, longitude: null })] });

    const res = await creer({ first_name: 'Jean', last_name: 'Tremblay', last_known_address: 'Nulle part' });

    expect(res.status).toBe(201);
    expect(query.mock.calls[0][1].slice(9)).toEqual(['Nulle part', null, null]);
    expect(res.body.warning).toMatch(/pas pu être placée/);
  });

  test('sans adresse : aucun appel au géocodage', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 5 }] })
      .mockResolvedValueOnce({ rows: [dossier({ last_known_address: null, latitude: null })] });

    const res = await creer({ first_name: 'Jean', last_name: 'Tremblay' });

    expect(res.status).toBe(201);
    expect(geocodeOrNull).not.toHaveBeenCalled();
    expect(res.body.warning).toBeUndefined();
  });

  test('400 si l\'adresse est trop longue ou n\'est pas un texte', async () => {
    expect((await creer({ first_name: 'J', last_name: 'T', last_known_address: 'x'.repeat(256) })).status).toBe(400);
    expect((await creer({ first_name: 'J', last_name: 'T', last_known_address: { rue: 'x' } })).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/criminals/:id/address', () => {
  const changer = (corps, auth = bearer) =>
    request(app).patch('/api/criminals/5/address').set('Authorization', auth).send(corps);

  test('un policier change l\'adresse; le dossier mis à jour est diffusé', async () => {
    geocodeOrNull.mockResolvedValue(BERRI);
    const misAJour = { id: 5, last_known_address: 'Berri-UQAM', ...BERRI };
    query.mockResolvedValueOnce({ rows: [{ id: 5 }] }).mockResolvedValueOnce({ rows: [misAJour] });

    const res = await changer({ last_known_address: 'Berri-UQAM' });

    expect(res.status).toBe(200);
    expect(query.mock.calls[0][1]).toEqual(['Berri-UQAM', 45.5153, -73.561, 3, '5']);
    expect(emitEvent).toHaveBeenCalledWith('criminal:updated', misAJour);
  });

  test('adresse vide : l\'adresse et la position sont effacées', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 5 }] }).mockResolvedValueOnce({ rows: [{ id: 5, last_known_address: null, latitude: null }] });

    const res = await changer({ last_known_address: '   ' });

    expect(res.status).toBe(200);
    expect(query.mock.calls[0][1].slice(0, 3)).toEqual([null, null, null]);
    expect(geocodeOrNull).not.toHaveBeenCalled();
  });

  test('404 si le dossier n\'existe pas', async () => {
    geocodeOrNull.mockResolvedValue(null);
    query.mockResolvedValueOnce({ rows: [] });

    expect((await changer({ last_known_address: 'Laval' })).status).toBe(404);
  });

  test('401 sans session', async () => {
    const res = await request(app).patch('/api/criminals/5/address').send({ last_known_address: 'Laval' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/geocode', () => {
  const chercher = (q, auth = bearer) => {
    const req = request(app).get('/api/geocode').query(q === undefined ? {} : { q });
    return auth ? req.set('Authorization', auth) : req;
  };

  test('renvoie la position de l\'adresse', async () => {
    geocode.mockResolvedValue(BERRI);
    const res = await chercher('Berri-UQAM, Montréal');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(BERRI);
  });

  test('404 si l\'adresse est introuvable', async () => {
    geocode.mockResolvedValue(null);
    expect((await chercher('zzzz introuvable')).status).toBe(404);
  });

  test('503 si le service de localisation ne répond pas', async () => {
    geocode.mockRejectedValue(new Error('GEOCODER_UNAVAILABLE'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect((await chercher('Montréal')).status).toBe(503);
  });

  test('400 si l\'adresse est trop courte ou absente', async () => {
    expect((await chercher('ab')).status).toBe(400);
    expect((await chercher(undefined)).status).toBe(400);
    expect(geocode).not.toHaveBeenCalled();
  });

  test('401 sans session : l\'API n\'est pas un relais ouvert vers Nominatim', async () => {
    expect((await chercher('Montréal', null)).status).toBe(401);
    expect(geocode).not.toHaveBeenCalled();
  });
});
