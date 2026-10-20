/**
 * Tests des routes /api/alerts avec Supertest (#12 : diffuser une alerte urgente).
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

const bearer = (role = 'superviseur') =>
  `Bearer ${jwt.sign({ id: 7, badge_number: 'SV-007', role, grade: 'sergent_autres_fonctions' }, 'test-secret')}`;

const alerte = {
  id: 3, criminal_id: null, message: 'Suspect armé', severity: 'urgent',
  created_at: '2026-10-20T12:00:00Z', issued_by: 'Jean Tremblay',
};
const dossier = { id: 1, first_name: 'Jean', last_name: 'Dupont', status: 'recherche', version: 1 };

// Répond selon la requête SQL : dossier (existant ou non), insertion, relecture, audit
const mockDb = ({ criminal = dossier } = {}) =>
  query.mockImplementation(async (sql) => {
    if (sql.includes('FROM criminal')) return { rows: criminal ? [criminal] : [] };
    if (sql.includes('INSERT INTO alert')) return { rows: [{ id: alerte.id }] };
    if (sql.includes('FROM alert')) return { rows: [alerte] };
    if (sql.includes('INSERT INTO audit_log')) return { rows: [{ id: 99 }] };
    throw new Error(`Requête inattendue : ${sql}`);
  });

const post = (body, role) =>
  request(app).post('/api/alerts').set('Authorization', bearer(role)).send(body);

const insertCall = () => query.mock.calls.find(([sql]) => sql.includes('INSERT INTO alert'));

beforeEach(() => {
  query.mockReset();
  emitEvent.mockReset();
});

describe('POST /api/alerts : permissions', () => {
  test('401 sans jeton', async () => {
    const res = await request(app).post('/api/alerts').send({ message: 'x' });
    expect(res.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  test('403 pour un policier', async () => {
    const res = await post({ message: 'Suspect armé' }, 'policier');
    expect(res.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
    expect(emitEvent).not.toHaveBeenCalled();
  });

  test.each(['superviseur', 'direction'])('201 pour %s', async (role) => {
    mockDb();
    const res = await post({ message: 'Suspect armé', severity: 'urgent' }, role);
    expect(res.status).toBe(201);
  });
});

describe('POST /api/alerts : message', () => {
  test.each([
    ['absent', {}],
    ['vide', { message: '' }],
    ['fait seulement d\'espaces', { message: '   \n\t ' }],
    ['qui n\'est pas du texte', { message: 42 }],
  ])('400 si le message est %s', async (_cas, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/obligatoire/);
    expect(query).not.toHaveBeenCalled();
    expect(emitEvent).not.toHaveBeenCalled();
  });

  test('400 au-delà de 500 caractères', async () => {
    const res = await post({ message: 'a'.repeat(501) });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/500 caractères/);
    expect(query).not.toHaveBeenCalled();
  });

  test('accepte exactement 500 caractères', async () => {
    mockDb();
    const res = await post({ message: 'a'.repeat(500) });
    expect(res.status).toBe(201);
  });

  test('compte la longueur après avoir retiré les espaces', async () => {
    mockDb();
    const res = await post({ message: `  ${'a'.repeat(500)}  ` });
    expect(res.status).toBe(201);
    expect(insertCall()[1][2]).toBe('a'.repeat(500));
  });

  test('enregistre le message sans les espaces autour', async () => {
    mockDb();
    await post({ message: '  Suspect armé  ' });
    expect(insertCall()[1][2]).toBe('Suspect armé');
  });
});

describe('POST /api/alerts : sévérité', () => {
  test('info par défaut', async () => {
    mockDb();
    await post({ message: 'Suspect armé' });
    expect(insertCall()[1][3]).toBe('info');
  });

  test('400 si la sévérité est inconnue', async () => {
    const res = await post({ message: 'Suspect armé', severity: 'critique' });
    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('POST /api/alerts : dossier lié', () => {
  test('201 et alerte liée si le dossier existe', async () => {
    mockDb();
    const res = await post({ message: 'Vu au centre-ville', severity: 'urgent', criminal_id: 1 });
    expect(res.status).toBe(201);
    expect(insertCall()[1][1]).toBe(1);
  });

  test('404 si le dossier n\'existe pas, sans rien enregistrer ni diffuser', async () => {
    mockDb({ criminal: null });
    const res = await post({ message: 'Vu au centre-ville', criminal_id: 999 });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Dossier introuvable/);
    expect(insertCall()).toBeUndefined();
    expect(emitEvent).not.toHaveBeenCalled();
  });

  test.each(['abc', -1, 0, 1.5, true])('400 si criminal_id vaut %p', async (criminal_id) => {
    const res = await post({ message: 'Suspect armé', criminal_id });
    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  test.each([null, ''])('alerte sans dossier si criminal_id vaut %p', async (criminal_id) => {
    mockDb();
    const res = await post({ message: 'Suspect armé', criminal_id });
    expect(res.status).toBe(201);
    expect(query.mock.calls.some(([sql]) => sql.includes('FROM criminal'))).toBe(false);
    expect(insertCall()[1][1]).toBeNull();
  });
});

describe('POST /api/alerts : diffusion', () => {
  test('diffuse l\'alerte avec l\'id de l\'émetteur et l\'inscrit au journal d\'audit', async () => {
    mockDb();
    const res = await post({ message: 'Suspect armé', severity: 'urgent' });
    expect(res.body.alert).toEqual(alerte);
    expect(emitEvent).toHaveBeenCalledWith('alert:broadcast', { ...alerte, issued_by_id: 7 });
    const audit = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO audit_log'));
    expect(audit[1].slice(0, 4)).toEqual([7, 'ALERT_ISSUED', 'alert', alerte.id]);
  });

  test('500 si la base échoue', async () => {
    query.mockRejectedValue(new Error('panne'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post({ message: 'Suspect armé' });
    expect(res.status).toBe(500);
    expect(emitEvent).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});