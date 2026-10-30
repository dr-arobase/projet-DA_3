/**
 * Tests unitaires du middleware verifyToken.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret';

const query = jest.fn();
jest.unstable_mockModule('../../src/config/db.js', () => ({
  pool: { query },
}));

const { verifyToken } = await import('../../src/middleware/auth.middleware.js');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

async function run(authorization) {
  const req = { headers: authorization ? { authorization } : {} };
  const res = mockRes();
  const next = jest.fn();
  await verifyToken(req, res, next);
  return { req, res, next };
}

describe('verifyToken', () => {
  beforeEach(() => {
    query.mockReset();
    query.mockResolvedValue({
      rows: [{ id: 3, badge_number: 'PL-003', role: 'policier', grade: 'sergent', is_active: true }],
    });
  });

  test('401 si aucun en-tête Authorization', async () => {
    const { res, next } = await run();

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('401 si l’en-tête ne contient pas de jeton après Bearer', async () => {
    const { res, next } = await run('Bearer');

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('403 si le jeton est invalide', async () => {
    const { res, next } = await run('Bearer invalide');

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('403 si le jeton est signé avec un autre secret', async () => {
    const token = jwt.sign({ id: 1 }, 'autre-secret');
    const { res, next } = await run(`Bearer ${token}`);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('403 si le jeton est expiré', async () => {
    const token = jwt.sign({ id: 1 }, 'test-secret', { expiresIn: -10 });
    const { res, next } = await run(`Bearer ${token}`);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('appelle next() et attache req.user si le jeton et le compte sont valides', async () => {
    const token = jwt.sign({ id: 3, role: 'policier' }, 'test-secret');
    const { req, res, next } = await run(`Bearer ${token}`);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user).toMatchObject({ id: 3, role: 'policier' });
    expect(query).toHaveBeenCalledWith(
      'SELECT id, badge_number, role, grade, is_active FROM app_user WHERE id = $1',
      [3]
    );
  });

  test('utilise le rôle courant en base plutôt que celui du jeton', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 3, badge_number: 'PL-003', role: 'policier', grade: 'sergent', is_active: true }],
    });
    const token = jwt.sign({ id: 3, role: 'direction', grade: 'general' }, 'test-secret');
    const { req, next } = await run(`Bearer ${token}`);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({ id: 3, badge_number: 'PL-003', role: 'policier', grade: 'sergent' });
  });

  test('401 si le compte a été désactivé après la création du jeton', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 3, badge_number: 'PL-003', role: 'policier', grade: 'sergent', is_active: false }],
    });
    const token = jwt.sign({ id: 3, role: 'policier' }, 'test-secret');
    const { res, next } = await run(`Bearer ${token}`);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Compte désactivé.' });
    expect(next).not.toHaveBeenCalled();
  });

  test('401 si le compte n’existe plus', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const token = jwt.sign({ id: 3, role: 'direction' }, 'test-secret');
    const { res, next } = await run(`Bearer ${token}`);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('transmet une panne de base de données au gestionnaire Express', async () => {
    const failure = new Error('Database unavailable');
    query.mockRejectedValueOnce(failure);
    const token = jwt.sign({ id: 3, role: 'policier' }, 'test-secret');
    const { next, res } = await run(`Bearer ${token}`);

    expect(next).toHaveBeenCalledWith(failure);
    expect(res.status).not.toHaveBeenCalled();
  });
});
