/**
 * Tests unitaires du service d'authentification.
 * La base de données est simulée (mock) : aucun PostgreSQL requis.
 */
import { jest, describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret';

const query = jest.fn();
jest.unstable_mockModule('../../src/config/db.js', () => ({
  pool: { query },
}));

const { loginUser, logoutUser } = await import('../../src/services/auth.service.js');

let passwordHash;
const fakeUser = () => ({
  id: 7,
  first_name: 'Eric',
  last_name: 'Tremblay',
  badge_number: 'SM-002',
  password_hash: passwordHash,
  role: 'superviseur',
  grade: 'lieutenant',
});

beforeAll(async () => {
  passwordHash = await bcrypt.hash('bonMotDePasse', 4);
});

beforeEach(() => {
  query.mockReset();
});

describe('loginUser', () => {
  test('cherche uniquement un agent actif par son matricule', async () => {
    query.mockResolvedValue({ rows: [fakeUser()] });

    await loginUser('SM-002', 'bonMotDePasse');

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/FROM app_user/);
    expect(sql).toMatch(/is_active = true/);
    expect(params).toEqual(['SM-002']);
  });

  test('lève INVALID_CREDENTIALS si le matricule est inconnu', async () => {
    query.mockResolvedValue({ rows: [] });

    await expect(loginUser('XX-999', 'peu importe')).rejects.toThrow('INVALID_CREDENTIALS');
  });

  test('lève INVALID_CREDENTIALS si le mot de passe est incorrect', async () => {
    query.mockResolvedValue({ rows: [fakeUser()] });

    await expect(loginUser('SM-002', 'mauvais')).rejects.toThrow('INVALID_CREDENTIALS');
  });

  test('retourne un jeton JWT valide avec les infos de l\'agent', async () => {
    query.mockResolvedValue({ rows: [fakeUser()] });

    const result = await loginUser('SM-002', 'bonMotDePasse');

    expect(result.message).toBe('Connexion réussie');
    const payload = jwt.verify(result.token, 'test-secret');
    expect(payload).toMatchObject({
      id: 7,
      badge_number: 'SM-002',
      role: 'superviseur',
      grade: 'lieutenant',
    });
    // Le jeton expire après 8 heures
    expect(payload.exp - payload.iat).toBe(8 * 60 * 60);
  });

  test('ne renvoie jamais le hash du mot de passe', async () => {
    query.mockResolvedValue({ rows: [fakeUser()] });

    const result = await loginUser('SM-002', 'bonMotDePasse');

    expect(result.user).toEqual({
      id: 7,
      first_name: 'Eric',
      last_name: 'Tremblay',
      badge_number: 'SM-002',
      role: 'superviseur',
      grade: 'lieutenant',
      avatar_url: null,
    });
    expect(result.user).not.toHaveProperty('password_hash');
    expect(jwt.decode(result.token)).not.toHaveProperty('password_hash');
  });

  test('propage les erreurs de la base de données', async () => {
    query.mockRejectedValue(new Error('connexion perdue'));

    await expect(loginUser('SM-002', 'bonMotDePasse')).rejects.toThrow('connexion perdue');
  });
});

describe('logoutUser', () => {
  test('retourne un message de déconnexion', async () => {
    const result = await logoutUser(7);

    expect(result.message).toMatch(/Déconnexion réussie/);
  });
});
