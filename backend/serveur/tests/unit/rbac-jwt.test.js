/**
 * Tests unitaires : utilitaire JWT et middleware de rôles (RBAC).
 */
import { jest, describe, test, expect, afterEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { signToken, verifyToken } from '../../src/utils/jwt.js';
import { requireRole } from '../../src/middleware/rbac.middleware.js';

describe('utils/jwt', () => {
  const saved = process.env.JWT_SECRET;
  afterEach(() => {
    process.env.JWT_SECRET = saved;
  });

  test('signe avec JWT_SECRET et expire après 8 h', () => {
    process.env.JWT_SECRET = 'test-secret';
    const token = signToken({ id: 1, role: 'policier' });

    const payload = jwt.verify(token, 'test-secret');
    expect(payload).toMatchObject({ id: 1, role: 'policier' });
    expect(payload.exp - payload.iat).toBe(8 * 60 * 60);
  });

  test('verifyToken relit un jeton signé par signToken', () => {
    process.env.JWT_SECRET = 'test-secret';

    expect(verifyToken(signToken({ id: 2 }))).toMatchObject({ id: 2 });
  });

  test('verifyToken rejette un jeton signé avec une autre clé', () => {
    process.env.JWT_SECRET = 'test-secret';
    const forged = jwt.sign({ id: 1 }, 'autre-cle');

    expect(() => verifyToken(forged)).toThrow();
  });
});

describe('requireRole', () => {
  const run = (minRole, role) => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    requireRole(minRole)({ user: role ? { role } : undefined }, res, next);
    return { res, next };
  };

  test.each([
    ['policier', 'policier'],
    ['superviseur', 'superviseur'],
    ['superviseur', 'direction'],
    ['direction', 'direction'],
  ])('requireRole(%s) laisse passer %s', (minRole, role) => {
    const { res, next } = run(minRole, role);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test.each([
    ['superviseur', 'policier'],
    ['direction', 'superviseur'],
    ['policier', 'inconnu'],
    ['policier', undefined],
  ])('requireRole(%s) refuse %s (403)', (minRole, role) => {
    const { res, next } = run(minRole, role);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
