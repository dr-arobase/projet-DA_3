/**
 * Tests des routes /api/users (gestion des comptes) avec Supertest.
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

const disconnectUser = jest.fn();
jest.unstable_mockModule('../../src/sockets/index.js', () => ({
  default: jest.fn(),
  emitEvent: jest.fn(),
  emitToUsers: jest.fn(),
  disconnectUser,
}));

const isAccountActive = jest.fn(async () => true);
let authenticatedRole = 'policier';
const getAccountAuthInfo = jest.fn(async (id) => ({
  id, badge_number: 'SUP-001', role: authenticatedRole, grade: 'lieutenant', is_active: true,
}));
const publishAccountDeactivated = jest.fn();
jest.unstable_mockModule('../../src/utils/account-status.js', () => ({
  isAccountActive,
  getAccountAuthInfo,
  publishAccountDeactivated,
  listenForAccountDeactivations: jest.fn(),
}));

const { default: app } = await import('../../src/app.js');

const bearer = (role) => (authenticatedRole = role) &&
  `Bearer ${jwt.sign({ id: 1, badge_number: 'SUP-001', role, grade: 'lieutenant' }, 'test-secret')}`;

const agent = { id: 5, first_name: 'Marc', last_name: 'Roy', badge_number: 'PL-005', role: 'policier' };

beforeEach(() => {
  query.mockReset();
  disconnectUser.mockReset();
  isAccountActive.mockResolvedValue(true);
  authenticatedRole = 'policier';
  getAccountAuthInfo.mockClear();
  publishAccountDeactivated.mockReset();
});

describe('contrôle des rôles', () => {
  test('401 sans jeton', async () => {
    const res = await request(app).get('/api/users');

    expect(res.status).toBe(401);
  });

  test('403 pour un policier', async () => {
    const res = await request(app).get('/api/users').set('Authorization', bearer('policier'));

    expect(res.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  test('la promotion est réservée à la direction', async () => {
    const res = await request(app)
      .patch('/api/users/5/promote')
      .set('Authorization', bearer('superviseur'))
      .send({ role: 'superviseur', grade: 'lieutenant' });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/users', () => {
  test('liste les comptes sans le mot de passe', async () => {
    query.mockResolvedValue({ rows: [agent] });

    const res = await request(app).get('/api/users').set('Authorization', bearer('superviseur'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual([agent]);
    expect(query.mock.calls[0][0]).not.toMatch(/password_hash/);
  });

  test('GET /:id renvoie 404 si le compte n\'existe pas', async () => {
    query.mockResolvedValue({ rows: [] });

    const res = await request(app).get('/api/users/999').set('Authorization', bearer('superviseur'));

    expect(res.status).toBe(404);
  });
});

describe('POST /api/users', () => {
  const body = {
    first_name: 'Marc', last_name: 'Roy', badge_number: 'PL-005',
    email: 'marc.roy@crimetracker.local', password: 'MotDePasse1!',
  };

  // Répond selon la requête : matricule pris ?, courriel pris ?, puis l'INSERT
  const mockDb = ({ badgeTaken = false, emailTaken = false, insertError = null } = {}) =>
    query.mockImplementation(async (sql) => {
      if (sql.includes('WHERE badge_number')) return { rows: badgeTaken ? [agent] : [] };
      if (sql.includes('WHERE email')) return { rows: emailTaken ? [{ '?column?': 1 }] : [] };
      if (sql.includes('INSERT INTO app_user')) {
        if (insertError) throw insertError;
        return { rows: [agent] };
      }
      throw new Error(`Requête inattendue : ${sql}`);
    });

  const post = (data, role = 'superviseur') =>
    request(app).post('/api/users').set('Authorization', bearer(role)).send(data);

  const insertParams = () => query.mock.calls.find(([sql]) => sql.includes('INSERT INTO app_user'))?.[1];

  test('201 : hache le mot de passe et applique le rôle / grade par défaut', async () => {
    mockDb();
    const res = await post(body);
    expect(res.status).toBe(201);
    const params = insertParams();
    expect(params[4]).toMatch(/^\$2[aby]\$/); // hash bcrypt, jamais le mot de passe en clair
    expect(params.slice(5)).toEqual(['policier', 'sergent_autres_fonctions']);
  });

  test.each(['superviseur', 'direction'])(
    '403 si un superviseur tente de créer un compte %s',
    async (role) => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', bearer('superviseur'))
        .send({ ...body, role, grade: role === 'direction' ? 'directeur_general' : 'lieutenant' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Seule la direction/);
      expect(query).not.toHaveBeenCalled();
    }
  );

  test.each([
    ['policier', 'sergent_autres_fonctions'],
    ['superviseur', 'lieutenant'],
    ['direction', 'directeur_general'],
  ])('la direction peut créer un compte %s', async (role, grade) => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...agent, role, grade }] });

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', bearer('direction'))
      .send({ ...body, role, grade });

    expect(res.status).toBe(201);
    expect(query.mock.calls[2][1].slice(5)).toEqual([role, grade]);
  });

  test('400 si un champ obligatoire manque', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', bearer('superviseur'))
      .send({ ...body, password: undefined });
    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  test('retire les espaces et met le courriel en minuscules', async () => {
    mockDb();
    await post({ ...body, first_name: '  Marc ', email: '  Marc.Roy@CrimeTracker.local ' });
    const params = insertParams();
    expect(params[0]).toBe('Marc');
    expect(params[3]).toBe('marc.roy@crimetracker.local');
  });

  test.each(['first_name', 'last_name', 'badge_number', 'email', 'password'])(
    '400 si %s manque', async (champ) => {
      const res = await post({ ...body, [champ]: undefined });
      expect(res.status).toBe(400);
      expect(query).not.toHaveBeenCalled();
    });

  test('400 si un champ n\'a que des espaces', async () => {
    const res = await post({ ...body, last_name: '   ' });
    expect(res.status).toBe(400);
  });

  test.each([
    ['first_name', 101], ['last_name', 101], ['badge_number', 21],
  ])('400 si %s dépasse la longueur maximale', async (champ, longueur) => {
    const res = await post({ ...body, [champ]: 'a'.repeat(longueur) });
    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  test.each(['pasuncourriel', 'marc@', '@crimetracker.local', 'marc roy@crimetracker.local', 'marc@local'])(
    '400 si le courriel « %s » est invalide', async (email) => {
      const res = await post({ ...body, email });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/courriel/i);
      expect(query).not.toHaveBeenCalled();
    });

  test('400 si le mot de passe fait moins de 8 caractères', async () => {
    const res = await post({ ...body, password: '1234567' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/8 caractères/);
    expect(query).not.toHaveBeenCalled();
  });

  test('accepte un mot de passe d\'exactement 8 caractères', async () => {
    mockDb();
    const res = await post({ ...body, password: '12345678' });
    expect(res.status).toBe(201);
  });

  test('400 si le mot de passe n\'est pas du texte', async () => {
    const res = await post({ ...body, password: 12345678 });
    expect(res.status).toBe(400);
  });

  test('400 si le rôle est inconnu', async () => {
    const res = await post({ ...body, role: 'admin' });
    expect(res.status).toBe(400);
  });

  test.each(['superviseur', 'direction'])('403 : un superviseur ne peut pas créer un compte %s', async (role) => {
    const res = await post({ ...body, role, grade: 'lieutenant' });
    expect(res.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  test('201 : la direction peut créer un superviseur', async () => {
    mockDb();
    const res = await post({ ...body, role: 'superviseur', grade: 'lieutenant' }, 'direction');
    expect(res.status).toBe(201);
    expect(insertParams().slice(5)).toEqual(['superviseur', 'lieutenant']);
  });

  test('403 pour un policier', async () => {
    const res = await post(body, 'policier');
    expect(res.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  test('409 si le matricule existe déjà', async () => {
    mockDb({ badgeTaken: true });
    const res = await post(body);
    expect(res.status).toBe(409);
    expect(insertParams()).toBeUndefined();
  });

  test('409 (et non 500) si le courriel est déjà pris', async () => {
    mockDb({ emailTaken: true });
    const res = await post(body);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/courriel/i);
    expect(insertParams()).toBeUndefined();
  });

  test('409 si la base refuse un doublon (deux créations en même temps)', async () => {
    mockDb({ insertError: Object.assign(new Error('duplicate key value'), { code: '23505' }) });
    const res = await post(body);
    expect(res.status).toBe(409);
  });

  test('500 pour une autre panne de la base', async () => {
    mockDb({ insertError: new Error('panne') });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post(body);
    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});

describe('activation, désactivation et promotion', () => {
  test('403 si un superviseur tente de désactiver son propre compte', async () => {
    const res = await request(app)
      .patch('/api/users/1/deactivate')
      .set('Authorization', bearer('superviseur'));

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: 'Vous ne pouvez pas désactiver votre propre compte.' });
    expect(query).not.toHaveBeenCalled();
    expect(disconnectUser).not.toHaveBeenCalled();
    expect(publishAccountDeactivated).not.toHaveBeenCalled();
  });

  test('403 si un superviseur tente de désactiver un compte de direction', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...agent, id: 8, role: 'direction' }] });

    const res = await request(app)
      .patch('/api/users/8/deactivate')
      .set('Authorization', bearer('superviseur'));

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      message: 'Un superviseur ne peut pas désactiver un compte de direction.',
    });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0]).toMatch(/role <> 'direction'/);
    expect(disconnectUser).not.toHaveBeenCalled();
    expect(publishAccountDeactivated).not.toHaveBeenCalled();
  });

  test.each([
    ['deactivate', 'USER_DEACTIVATED', false],
    ['reactivate', 'USER_REACTIVATED', true],
  ])('PATCH /:id/%s journalise %s', async (route, action, isActive) => {
    query
      .mockResolvedValueOnce({ rows: [{ ...agent, is_active: isActive }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] });

    const res = await request(app).patch(`/api/users/5/${route}`).set('Authorization', bearer('superviseur'));

    expect(res.status).toBe(200);
    if (isActive) {
      expect(query.mock.calls[0][1]).toEqual([isActive, '5']);
    } else {
      expect(query.mock.calls[0][1]).toEqual(['5', 'superviseur']);
      expect(query.mock.calls[0][0]).toMatch(/role <> 'direction'/);
    }
    expect(query.mock.calls[1][1].slice(0, 4)).toEqual([1, action, 'user', 5]);
    if (!isActive) {
      expect(disconnectUser).toHaveBeenCalledWith(5);
      expect(publishAccountDeactivated).toHaveBeenCalledWith(5);
    }
    else expect(disconnectUser).not.toHaveBeenCalled();
  });

  test('PATCH /:id/promote change rôle et grade (direction)', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ ...agent, role: 'superviseur' }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] });

    const res = await request(app)
      .patch('/api/users/5/promote')
      .set('Authorization', bearer('direction'))
      .send({ role: 'superviseur', grade: 'lieutenant' });

    expect(res.status).toBe(200);
    expect(query.mock.calls[1][1][1]).toBe('USER_PROMOTED');
  });

  test('PATCH /:id/promote : 400 si le grade est inconnu', async () => {
    const res = await request(app)
      .patch('/api/users/5/promote')
      .set('Authorization', bearer('direction'))
      .send({ role: 'superviseur', grade: 'general' });

    expect(res.status).toBe(400);
  });

  test('404 si le compte n\'existe pas', async () => {
    query.mockResolvedValue({ rows: [] });

    const res = await request(app).patch('/api/users/999/deactivate').set('Authorization', bearer('superviseur'));

    expect(res.status).toBe(404);
  });
});


describe('grade et rôle doivent correspondre (03-conception.md)', () => {
  const nouveau = {
    first_name: 'Marc', last_name: 'Roy', badge_number: 'PL-005',
    email: 'marc.roy@crimetracker.local', password: 'MotDePasse1!',
  };

  // Création : matricule et courriel libres, puis l'INSERT
  const mockCreation = () =>
    query.mockImplementation(async (sql) =>
      (sql.includes('INSERT INTO app_user') ? { rows: [agent] } : { rows: [] }));

  const creer = (data, role = 'direction') =>
    request(app).post('/api/users').set('Authorization', bearer(role)).send({ ...nouveau, ...data });

  const promouvoir = (data) =>
    request(app).patch('/api/users/5/promote').set('Authorization', bearer('direction')).send(data);

  test.each([
    ['policier', 'lieutenant'],
    ['policier', 'directeur_general'],
    ['superviseur', 'sergent_autres_fonctions'],
    ['superviseur', 'directeur_general_adjoint'],
    ['direction', 'capitaine'],
  ])('promotion : 400 pour un %s avec le grade %s, sans rien modifier', async (role, grade) => {
    const res = await promouvoir({ role, grade });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/ne correspond pas/);
    expect(query).not.toHaveBeenCalled();
  });

  test.each([
    ['policier', 'sergent_autres_fonctions'],
    ['superviseur', 'sergent_gestionnaire'],
    ['superviseur', 'inspecteur_chef'],
    ['direction', 'directeur_general_adjoint'],
    ['direction', 'directeur_general'],
  ])('promotion : 200 pour un %s avec le grade %s', async (role, grade) => {
    query
      .mockResolvedValueOnce({ rows: [{ ...agent, role, grade }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const res = await promouvoir({ role, grade });
    expect(res.status).toBe(200);
  });

  test('création : 400 pour un policier lieutenant, même créé par un superviseur', async () => {
    const res = await creer({ role: 'policier', grade: 'lieutenant' }, 'superviseur');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/ne correspond pas/);
    expect(query).not.toHaveBeenCalled();
  });

  test('création : 400 pour un directeur avec le grade capitaine', async () => {
    const res = await creer({ role: 'direction', grade: 'capitaine' });
    expect(res.status).toBe(400);
  });

  test('création : sans grade, un superviseur reçoit le premier grade de son rôle', async () => {
    mockCreation();
    const res = await creer({ role: 'superviseur' });
    expect(res.status).toBe(201);
    const params = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO app_user'))[1];
    expect(params.slice(5)).toEqual(['superviseur', 'sergent_gestionnaire']);
  });
});