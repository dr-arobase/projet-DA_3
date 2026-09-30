/**
 * Tests unitaires du middleware verifyToken.
 */
import { jest, describe, test, expect } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../../src/middleware/auth.middleware.js';

process.env.JWT_SECRET = 'test-secret';

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function run(authorization) {
  const req = { headers: authorization ? { authorization } : {} };
  const res = mockRes();
  const next = jest.fn();
  verifyToken(req, res, next);
  return { req, res, next };
}

describe('verifyToken', () => {
  test('401 si aucun en-tête Authorization', () => {
    const { res, next } = run();

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('401 si l\'en-tête ne contient pas de jeton après "Bearer"', () => {
    const { res, next } = run('Bearer');

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('403 si le jeton est invalide', () => {
    const { res, next } = run('Bearer nimporte.quoi.ici');

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('403 si le jeton est signé avec un autre secret', () => {
    const token = jwt.sign({ id: 1 }, 'autre-secret');
    const { res, next } = run(`Bearer ${token}`);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('403 si le jeton est expiré', () => {
    const token = jwt.sign({ id: 1 }, 'test-secret', { expiresIn: -10 });
    const { res, next } = run(`Bearer ${token}`);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('appelle next() et attache req.user si le jeton est valide', () => {
    const token = jwt.sign({ id: 3, role: 'policier' }, 'test-secret');
    const { req, res, next } = run(`Bearer ${token}`);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user).toMatchObject({ id: 3, role: 'policier' });
  });
});
