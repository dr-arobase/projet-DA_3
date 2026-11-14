/**
 * Tests des routes /api/alerts avec Supertest (#12 : diffuser une alerte urgente).
 * #202 : un policier diffuse une alerte (urgent); un communiqué (info) reste réservé
 * au superviseur et à la direction.
 * #220 : modifier, retirer (archiver) et remettre une diffusion, pour son auteur ou la direction.
 * La base de données est simulée : aucun PostgreSQL requis.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret';

const query = jest.fn();
let authenticatedRole = 'superviseur';
jest.unstable_mockModule('../../src/config/db.js', () => ({
  pool: { query },
  initializeDatabase: jest.fn(),
  closeDatabase: jest.fn(),
  withTransaction: jest.fn(),
}));

jest.unstable_mockModule('../../src/utils/account-status.js', () => ({
  getAccountAuthInfo: jest.fn(async (id) => ({
    id, badge_number: 'SV-007', role: authenticatedRole, grade: 'sergent_gestionnaire', is_active: true,
  })),
  isAccountActive: jest.fn(async () => true),
  publishAccountDeactivated: jest.fn(),
  listenForAccountDeactivations: jest.fn(),
}));

const emitEvent = jest.fn();
const disconnectUser = jest.fn();
jest.unstable_mockModule('../../src/sockets/index.js', () => ({
  default: jest.fn(),
  emitEvent,
  emitToUsers: jest.fn(),
  disconnectUser,
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

const post = (body, role) => {
  authenticatedRole = role || 'superviseur';
  return request(app).post('/api/alerts').set('Authorization', bearer(role)).send(body);
};

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

  test.each(['policier', 'superviseur', 'direction'])('alerte (urgent) : 201 pour un %s', async (role) => {
    mockDb();
    const res = await post({ message: 'Suspect armé', severity: 'urgent' }, role);
    expect(res.status).toBe(201);
    expect(insertCall()[1][3]).toBe('urgent');
    expect(emitEvent).toHaveBeenCalled();
  });

  test.each([
    ['explicite', { message: 'Réunion à 8 h', severity: 'info' }],
    ['par défaut (sans severity)', { message: 'Réunion à 8 h' }],
  ])('communiqué %s : 403 pour un policier, sans rien enregistrer ni diffuser', async (_cas, body) => {
    const res = await post(body, 'policier');
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/communiqué/);
    expect(query).not.toHaveBeenCalled();
    expect(emitEvent).not.toHaveBeenCalled();
  });

  test('un policier sans droit au communiqué n\'apprend rien du message (403 avant le 400)', async () => {
    const res = await post({ message: '', severity: 'info' }, 'policier');
    expect(res.status).toBe(403);
  });

  test.each(['superviseur', 'direction'])('communiqué (info) : 201 pour un %s', async (role) => {
    mockDb();
    const res = await post({ message: 'Réunion à 8 h', severity: 'info' }, role);
    expect(res.status).toBe(201);
    expect(insertCall()[1][3]).toBe('info');
  });
});

describe('POST /api/alerts : message', () => {
  test.each([
    ['absent', {}],
    ['vide', { message: '' }],
    ['fait seulement d\'espaces', { message: '   \n\t ' }],
    ['fait seulement de caractères invisibles', { message: '\u200B\u200B\u2800' }],
    ['qui n\'est pas du texte', { message: 42 }],
  ])('400 si le message est %s', async (_cas, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/obligatoire/);
    expect(query).not.toHaveBeenCalled();
    expect(emitEvent).not.toHaveBeenCalled();
  });

  // Sans limite de caractères (demande du Product Owner, #219) : seule la taille d'une requête, 1 Mo, la borne
  test.each([501, 2001, 50000])('accepte un message de %i caractères', async (longueur) => {
    mockDb();
    const res = await post({ message: 'a'.repeat(longueur) });
    expect(res.status).toBe(201);
    expect(insertCall()[1][2]).toHaveLength(longueur);
  });

  test('413 en français au-delà de 1 Mo, sans rien enregistrer', async () => {
    const res = await post({ message: 'a'.repeat(1100000) });
    expect(res.status).toBe(413);
    expect(res.body.message).toBe('Le contenu envoyé est trop volumineux (1 Mo au plus).');
    expect(query).not.toHaveBeenCalled();
    expect(emitEvent).not.toHaveBeenCalled();
  });

  test('retire les espaces autour d\'un long message', async () => {
    mockDb();
    const res = await post({ message: `  ${'a'.repeat(5000)}  ` });
    expect(res.status).toBe(201);
    expect(insertCall()[1][2]).toBe('a'.repeat(5000));
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

// #84 : des filtres mal formés donnaient une panne serveur (500) au lieu d'un 400
describe('GET /api/alerts : filtres (#84)', () => {
  const get = (url) => {
    authenticatedRole = 'policier';
    return request(app).get(url).set('Authorization', bearer('policier'));
  };
  const mockListe = () => query.mockImplementation(async (sql) => {
    if (sql.includes('COUNT(*)')) return { rows: [{ count: '1' }] };
    if (sql.includes('FROM alert')) return { rows: [alerte] };
    throw new Error(`Requête inattendue : ${sql}`);
  });
  const sqlListe = () => query.mock.calls.find(([sql]) => sql.includes('ORDER BY'));

  test.each([
    ['gravité inconnue', '?severity=critique', 'severity'],
    ['gravité en majuscules', '?severity=URGENT', 'severity'],
    ['gravité répétée', '?severity=urgent&severity=info', 'severity'],
    ['gravité en tableau', '?severity[]=urgent', 'severity'],
    ['gravité en objet', '?severity[a]=urgent', 'severity'],
    ['date qui n\'en est pas une', '?since=hier', 'since'],
    ['jour qui n\'existe pas', '?since=2026-02-30', 'since'],
    ['heure impossible', '?since=2026-11-14T25:00:00Z', 'since'],
    ['an 0, refusé par PostgreSQL', '?since=0000-01-01', 'since'],
    ['date seulement en chiffres', '?since=1', 'since'],
    ['date répétée', '?since=2026-11-14&since=2026-11-15', 'since'],
  ])('400 pour une %s, sans requête SQL', async (_cas, filtres, champ) => {
    const res = await get(`/api/alerts${filtres}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain(`Filtre ${champ} invalide`);
    expect(query).not.toHaveBeenCalled();
  });

  test('filtres valides : envoyés à la base et total renvoyé', async () => {
    mockListe();
    const depuis = '2026-11-14T05:00:00.000Z';
    const res = await get(`/api/alerts?severity=urgent&since=${depuis}&limit=1`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, limit: 1, total: 1, totalPages: 1, data: [alerte] });
    expect(sqlListe()[1]).toEqual(['urgent', depuis, 1, 0]);
  });

  test('une date sans heure est lue en UTC et envoyée sous une seule forme', async () => {
    mockListe();
    const res = await get('/api/alerts?since=2026-11-14');
    expect(res.status).toBe(200);
    expect(sqlListe()[1]).toEqual(['2026-11-14T00:00:00.000Z', 20, 0]);
  });

  test('une date avec un décalage horaire est acceptée', async () => {
    mockListe();
    const res = await get(`/api/alerts?since=${encodeURIComponent('2026-11-14T08:00:00-05:00')}`);
    expect(res.status).toBe(200);
    expect(sqlListe()[1]).toEqual(['2026-11-14T13:00:00.000Z', 20, 0]);
  });

  test('un filtre vide n\'est pas appliqué, comme avant', async () => {
    mockListe();
    const res = await get('/api/alerts?severity=&since=');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ page: 1, limit: 20, data: [alerte] });
    expect(sqlListe()[1]).toEqual([20, 0]);
  });
});

// #220 (demande du PO) : modifier, retirer et remettre une alerte ou un communiqué.
// Règle : l'auteur de la diffusion ou la direction. Retirer = archiver, jamais de DELETE.
describe('Modifier, retirer et remettre une diffusion (#220)', () => {
  const AUTEUR = 7; // l'agent connecté dans ces tests (voir bearer)
  const AUTRE = 8;
  let etat; // la ligne de la table alert, telle que la « base » simulée la garde

  const diffusion = (champs = {}) => ({
    id: 3, criminal_id: null, message: 'Suspect armé', severity: 'urgent',
    created_at: '2026-11-14T12:00:00Z', issued_by_id: AUTEUR, issued_by: 'Jean Tremblay',
    criminal_name: null, edited_at: null, edited_by: null, archived_at: null, archived_by: null,
    ...champs,
  });

  // Base simulée : les UPDATE modifient « etat », comme le feraient les requêtes du modèle
  const mockDiffusion = (champs = {}) => {
    etat = champs === null ? null : diffusion(champs);
    query.mockImplementation(async (sql, params) => {
      if (sql.includes('UPDATE alert SET message')) {
        if (!etat || etat.archived_at) return { rows: [] };
        etat = { ...etat, message: params[0], edited_at: '2026-11-14T17:00:00Z', edited_by: 'Jean Tremblay' };
        return { rows: [{ id: etat.id }] };
      }
      if (sql.includes('archived_at = now()')) {
        if (!etat || etat.archived_at) return { rows: [] };
        etat = { ...etat, archived_at: '2026-11-14T18:00:00Z', archived_by: 'Jean Tremblay' };
        return { rows: [{ id: etat.id }] };
      }
      if (sql.includes('archived_at = NULL')) {
        if (!etat || !etat.archived_at) return { rows: [] };
        etat = { ...etat, archived_at: null, archived_by: null };
        return { rows: [{ id: etat.id }] };
      }
      if (sql.includes('COUNT(*)')) return { rows: [{ count: '1' }] };
      if (sql.includes('FROM alert')) return { rows: etat ? [etat] : [] };
      if (sql.includes('INSERT INTO audit_log')) return { rows: [{ id: 99 }] };
      throw new Error(`Requête inattendue : ${sql}`);
    });
  };

  const envoyer = (method, url, role = 'policier', body) => {
    authenticatedRole = role;
    const req = request(app)[method](url).set('Authorization', bearer(role));
    return body ? req.send(body) : req;
  };
  const modifier = (body, role) => envoyer('patch', '/api/alerts/3', role, body);
  const retirer = (role) => envoyer('post', '/api/alerts/3/archive', role);
  const remettre = (role) => envoyer('post', '/api/alerts/3/restore', role);

  const ecritures = () => query.mock.calls.filter(([sql]) => /UPDATE|DELETE/.test(sql));
  const audit = () => query.mock.calls.find(([sql]) => sql.includes('INSERT INTO audit_log'));
  const details = () => JSON.parse(audit()[1][4]);

  describe('PATCH /api/alerts/:id : modifier', () => {
    test('l\'auteur modifie le texte : mention « modifié », diffusée en direct et journalisée', async () => {
      mockDiffusion();
      const res = await modifier({ message: '  Suspect armé, direction est  ' });

      expect(res.status).toBe(200);
      expect(res.body.alert).toMatchObject({
        id: 3, message: 'Suspect armé, direction est', severity: 'urgent',
        edited_at: '2026-11-14T17:00:00Z', edited_by: 'Jean Tremblay',
      });
      expect(emitEvent).toHaveBeenCalledWith('alert:updated', res.body.alert);
      expect(audit()[1].slice(0, 4)).toEqual([AUTEUR, 'ALERT_EDITED', 'alert', 3]);
      expect(details()).toEqual({ severity: 'urgent', ancien_message: 'Suspect armé' });
    });

    test('la direction modifie la diffusion d\'un autre agent', async () => {
      mockDiffusion({ issued_by_id: AUTRE, severity: 'info' });
      const res = await modifier({ message: 'Réunion déplacée à 9 h' }, 'direction');

      expect(res.status).toBe(200);
      expect(res.body.alert.message).toBe('Réunion déplacée à 9 h');
    });

    test.each(['policier', 'superviseur'])('403 pour un %s qui n\'en est pas l\'auteur, sans rien écrire', async (role) => {
      mockDiffusion({ issued_by_id: AUTRE });
      const res = await modifier({ message: 'Texte changé' }, role);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/auteur de la diffusion ou la direction/);
      expect(ecritures()).toEqual([]);
      expect(emitEvent).not.toHaveBeenCalled();
    });

    test('404 si la diffusion n\'existe pas', async () => {
      mockDiffusion(null);
      const res = await modifier({ message: 'Texte changé' });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Diffusion introuvable');
    });

    test.each([
      ['vide', ''],
      ['fait d\'espaces', '   '],
      ['fait de caractères invisibles', '\u200B\u200B'],
      ['qui n\'est pas du texte', 42],
    ])('400 pour un message %s, sans rien écrire', async (_cas, message) => {
      mockDiffusion();
      const res = await modifier({ message });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Le champ message est obligatoire');
      expect(ecritures()).toEqual([]);
    });

    test('409 si la diffusion est retirée', async () => {
      mockDiffusion({ archived_at: '2026-11-14T18:00:00Z' });
      const res = await modifier({ message: 'Texte changé' });

      expect(res.status).toBe(409);
      expect(ecritures()).toEqual([]);
    });

    test('même texte : rien n\'est écrit, pas de mention « modifié »', async () => {
      mockDiffusion();
      const res = await modifier({ message: 'Suspect armé ' });

      expect(res.status).toBe(200);
      expect(res.body.alert.edited_at).toBeNull();
      expect(ecritures()).toEqual([]);
      expect(emitEvent).not.toHaveBeenCalled();
    });

    test('400 pour un identifiant invalide, sans requête SQL', async () => {
      const res = await envoyer('patch', '/api/alerts/abc', 'policier', { message: 'x' });

      expect(res.status).toBe(400);
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/alerts/:id/archive : retirer', () => {
    test('l\'auteur retire sa diffusion : archivée (aucun DELETE), diffusée en direct et journalisée', async () => {
      mockDiffusion();
      const res = await retirer();

      expect(res.status).toBe(200);
      expect(res.body.alert).toMatchObject({ id: 3, archived_at: '2026-11-14T18:00:00Z' });
      expect(query.mock.calls.some(([sql]) => sql.includes('DELETE'))).toBe(false);
      expect(emitEvent).toHaveBeenCalledWith('alert:archived', res.body.alert);
      expect(audit()[1].slice(0, 4)).toEqual([AUTEUR, 'ALERT_ARCHIVED', 'alert', 3]);
    });

    test('la direction retire la diffusion d\'un autre agent', async () => {
      mockDiffusion({ issued_by_id: AUTRE });
      expect((await retirer('direction')).status).toBe(200);
    });

    test.each(['policier', 'superviseur'])('403 pour un %s qui n\'en est pas l\'auteur', async (role) => {
      mockDiffusion({ issued_by_id: AUTRE });
      const res = await retirer(role);

      expect(res.status).toBe(403);
      expect(ecritures()).toEqual([]);
      expect(emitEvent).not.toHaveBeenCalled();
    });

    test('409 si elle est déjà retirée', async () => {
      mockDiffusion({ archived_at: '2026-11-14T18:00:00Z' });
      const res = await retirer();

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Cette diffusion est déjà retirée');
    });

    test('404 si la diffusion n\'existe pas', async () => {
      mockDiffusion(null);
      expect((await retirer()).status).toBe(404);
    });
  });

  describe('POST /api/alerts/:id/restore : remettre', () => {
    test('la direction remet une diffusion retirée : diffusée en direct et journalisée', async () => {
      mockDiffusion({ issued_by_id: AUTRE, archived_at: '2026-11-14T18:00:00Z', archived_by: 'Marie Roy' });
      const res = await remettre('direction');

      expect(res.status).toBe(200);
      expect(res.body.alert).toMatchObject({ id: 3, archived_at: null, archived_by: null });
      expect(emitEvent).toHaveBeenCalledWith('alert:restored', res.body.alert);
      expect(audit()[1].slice(0, 4)).toEqual([AUTEUR, 'ALERT_RESTORED', 'alert', 3]);
    });

    test('l\'auteur remet sa propre diffusion', async () => {
      mockDiffusion({ archived_at: '2026-11-14T18:00:00Z' });
      expect((await remettre()).status).toBe(200);
    });

    test('403 pour un agent qui n\'en est pas l\'auteur', async () => {
      mockDiffusion({ issued_by_id: AUTRE, archived_at: '2026-11-14T18:00:00Z' });
      const res = await remettre('superviseur');

      expect(res.status).toBe(403);
      expect(ecritures()).toEqual([]);
    });

    test('409 si elle n\'est pas retirée', async () => {
      mockDiffusion();
      const res = await remettre();

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Cette diffusion n\'est pas retirée');
    });
  });

  describe('GET /api/alerts : diffusions retirées', () => {
    const sqlListe = () => query.mock.calls.find(([sql]) => sql.includes('ORDER BY'))[0];

    test('par défaut, les diffusions retirées ne sont pas dans la liste', async () => {
      mockDiffusion();
      const res = await envoyer('get', '/api/alerts?severity=urgent');

      expect(res.status).toBe(200);
      expect(sqlListe()).toContain('a.archived_at IS NULL');
    });

    test('?archived=true : seulement les retirées, les dernières retirées en premier, avec le total', async () => {
      mockDiffusion({ archived_at: '2026-11-14T18:00:00Z' });
      const res = await envoyer('get', '/api/alerts?archived=true');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ total: 1, data: [etat] });
      expect(sqlListe()).toContain('a.archived_at IS NOT NULL');
      expect(sqlListe()).toContain('ORDER BY a.archived_at DESC');
    });

    test('400 pour une valeur d\'archived inconnue', async () => {
      const res = await envoyer('get', '/api/alerts?archived=oui');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Filtre archived invalide');
      expect(query).not.toHaveBeenCalled();
    });
  });
});
