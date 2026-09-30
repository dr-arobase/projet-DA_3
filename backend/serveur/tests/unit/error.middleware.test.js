/**
 * Tests unitaires du middleware global de gestion des erreurs.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { errorHandler } from '../../src/middleware/error.middleware.js';

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

let consoleSpy;
beforeEach(() => {
  consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  consoleSpy.mockRestore();
});

describe('errorHandler', () => {
  test('utilise err.status quand il existe', () => {
    const res = mockRes();
    const err = Object.assign(new Error('Introuvable'), { status: 404 });

    errorHandler(err, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Introuvable' });
  });

  test('utilise err.statusCode sinon', () => {
    const res = mockRes();
    const err = Object.assign(new Error('Requête invalide'), { statusCode: 400 });

    errorHandler(err, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('renvoie 500 par défaut', () => {
    const res = mockRes();

    errorHandler(new Error('boom'), {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'boom' });
  });

  test('message par défaut si l\'erreur n\'en a pas', () => {
    const res = mockRes();

    errorHandler({}, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Erreur serveur' });
  });

  test('journalise l\'erreur dans la console', () => {
    const err = new Error('à journaliser');

    errorHandler(err, {}, mockRes(), () => {});

    expect(consoleSpy).toHaveBeenCalledWith(err);
  });
});
