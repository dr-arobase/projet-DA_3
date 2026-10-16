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

  test('renvoie 500 par défaut, sans le détail de la panne', () => {
    const res = mockRes();

    errorHandler(new Error('relation "app_user" does not exist'), {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Erreur serveur' });
  });

  test('fichier absent (express.static) : 404 générique, sans le chemin du serveur, pas journalisé', () => {
    const res = mockRes();
    const err = Object.assign(new Error("ENOENT: no such file or directory, stat 'C:\\Users\\x\\avatars\\1.jpg'"), {
      status: 404, statusCode: 404, expose: false,
    });

    errorHandler(err, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Ressource introuvable' });
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  test('message par défaut si l\'erreur n\'en a pas', () => {
    const res = mockRes();

    errorHandler({}, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Erreur serveur' });
  });

  test('journalise une panne (5xx) dans la console', () => {
    const err = new Error('à journaliser');

    errorHandler(err, {}, mockRes(), () => {});

    expect(consoleSpy).toHaveBeenCalledWith(err);
  });

  test('ne journalise pas une erreur du client (4xx)', () => {
    errorHandler(Object.assign(new Error('Introuvable'), { status: 404 }), {}, mockRes(), () => {});

    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
