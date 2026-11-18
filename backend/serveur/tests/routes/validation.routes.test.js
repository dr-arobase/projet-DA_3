/**
 * C38 (#94) : chaque champ d'une route qui écrit est vérifié côté serveur (type et longueur).
 * Un texte trop long, vide, fait seulement de caractères invisibles ou du mauvais type
 * répond 400 avec un message en français, et rien n'est écrit.
 * Un test de refus par champ; la base est simulée (aucun PostgreSQL requis).
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

jest.unstable_mockModule('../../src/sockets/index.js', () => ({
  default: jest.fn(),
  emitEvent: jest.fn(),
  emitToUsers: jest.fn(),
  disconnectUser: jest.fn(),
}));

let authenticatedRole = 'policier';
jest.unstable_mockModule('../../src/utils/account-status.js', () => ({
  getAccountAuthInfo: jest.fn(async (id) => ({
    id, badge_number: 'AG-007', role: authenticatedRole, grade: 'lieutenant', is_active: true,
  })),
  publishAccountDeactivated: jest.fn(),
  listenForAccountDeactivations: jest.fn(),
}));

const { default: app } = await import('../../src/app.js');

const bearer = (role) => {
  authenticatedRole = role;
  return `Bearer ${jwt.sign({ id: 7, badge_number: 'AG-007', role, grade: 'lieutenant' }, 'test-secret')}`;
};

// Caractères invisibles seuls : trim() ne les retire pas, l'écran affichait un nom vide
const INVISIBLE = '​​';
const LONG = (n) => 'a'.repeat(n);

beforeEach(() => {
  query.mockReset();
  // Toute requête SQL inattendue échoue : un refus doit arriver AVANT la base
  query.mockRejectedValue(new Error('aucune requête SQL ne devait partir'));
});

// Un refus : 400, message en français, aucune écriture en base
async function expectRefus(method, url, role, body, message) {
  let req = request(app)[method](url);
  if (role) req = req.set('Authorization', bearer(role));
  const res = await req.send(body);
  expect(res.status).toBe(400);
  expect(res.body.message).toMatch(message);
  expect(query).not.toHaveBeenCalled();
}

describe('POST /api/criminals : chaque champ du dossier', () => {
  const valide = { first_name: 'Jean', last_name: 'Dupont' };
  const creer = (champs, message) => expectRefus('post', '/api/criminals', 'policier', { ...valide, ...champs }, message);

  test.each([
    ['prénom absent', { first_name: undefined }, /prénom et le nom sont obligatoires/],
    ['prénom fait d\'espaces', { first_name: '   ' }, /prénom et le nom sont obligatoires/],
    ['prénom invisible (U+200B)', { first_name: INVISIBLE }, /prénom et le nom sont obligatoires/],
    ['prénom qui n\'est pas du texte', { first_name: 42 }, /prénom doit être un texte/],
    ['prénom de 101 caractères', { first_name: LONG(101) }, /prénom dépasse 100 caractères/],
    ['nom invisible (U+200B)', { last_name: INVISIBLE }, /prénom et le nom sont obligatoires/],
    ['nom en tableau', { last_name: ['Dupont'] }, /nom doit être un texte/],
    ['nom de 101 caractères', { last_name: LONG(101) }, /nom dépasse 100 caractères/],
    ['nationalité en objet', { nationality: { pays: 'CA' } }, /nationalité doit être un texte/],
    ['nationalité de 101 caractères', { nationality: LONG(101) }, /nationalité dépasse 100 caractères/],
    ['description en nombre', { description: 12 }, /description doit être un texte/],
    ['description de 10 001 caractères', { description: LONG(10001) }, /description dépasse 10000 caractères/],
    ['crimes en tableau', { crimes: ['vol'] }, /crimes doit être un texte/],
    ['crimes de 10 001 caractères', { crimes: LONG(10001) }, /crimes dépasse 10000 caractères/],
    ['date de naissance en nombre', { date_of_birth: 19900101 }, /date de naissance est invalide/],
    ['date de naissance impossible', { date_of_birth: '1990-02-30' }, /date de naissance est invalide/],
    ['adresse en objet', { last_known_address: { rue: 'Berri' } }, /adresse doit être un texte/],
    ['adresse de 256 caractères', { last_known_address: LONG(256) }, /adresse dépasse 255 caractères/],
    ['statut de départ inconnu', { status: ['capture'] }, /Statut invalide/],
  ])('400 : %s', async (_cas, champs, message) => {
    await creer(champs, message);
  });

  test('10 000 caractères de description sont acceptés', async () => {
    query.mockReset();
    query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // INSERT
      .mockResolvedValueOnce({ rows: [{ id: 1, ...valide }] }) // findById
      .mockResolvedValueOnce({ rows: [{ id: 9 }] }); // journal d'audit
    const res = await request(app)
      .post('/api/criminals')
      .set('Authorization', bearer('policier'))
      .send({ ...valide, description: LONG(10000) });
    expect(res.status).toBe(201);
  });

  test('une nationalité invisible est ignorée (champ facultatif), pas enregistrée vide', async () => {
    query.mockReset();
    query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, ...valide }] })
      .mockResolvedValueOnce({ rows: [{ id: 9 }] });
    const res = await request(app)
      .post('/api/criminals')
      .set('Authorization', bearer('policier'))
      .send({ ...valide, nationality: INVISIBLE });
    expect(res.status).toBe(201);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO criminal/);
    expect(params).not.toContain(INVISIBLE);
  });
});

describe('PUT /api/criminals/:id : mêmes règles à la modification', () => {
  test.each([
    ['prénom invisible', { first_name: INVISIBLE }, /obligatoires/],
    ['nom de 101 caractères', { last_name: LONG(101) }, /nom dépasse 100 caractères/],
    ['description de 10 001 caractères', { description: LONG(10001) }, /description dépasse 10000 caractères/],
    ['crimes en objet', { crimes: { liste: [] } }, /crimes doit être un texte/],
    ['version qui n\'est pas un nombre', { version: 'abc' }, /version doit être un nombre entier positif/],
  ])('400 : %s', async (_cas, champs, message) => {
    const body = { first_name: 'Jean', last_name: 'Dupont', version: 1, ...champs };
    await expectRefus('put', '/api/criminals/1', 'superviseur', body, message);
  });
});

describe('PATCH /api/criminals/:id/status et /address', () => {
  test.each([
    ['statut en tableau', { status: ['capture'], version: 1 }, /Statut invalide/],
    ['statut inconnu', { status: 'WANTED', version: 1 }, /Statut invalide/],
    ['version décimale', { status: 'capture', version: 1.5 }, /version doit être un nombre entier positif/],
  ])('statut, 400 : %s', async (_cas, body, message) => {
    await expectRefus('patch', '/api/criminals/1/status', 'policier', body, message);
  });

  test.each([
    ['adresse en nombre', { last_known_address: 1234 }, /adresse doit être un texte/],
    ['adresse de 256 caractères', { last_known_address: LONG(256) }, /adresse dépasse 255 caractères/],
  ])('adresse, 400 : %s', async (_cas, body, message) => {
    await expectRefus('patch', '/api/criminals/1/address', 'policier', body, message);
  });
});

describe('POST /api/sightings : signalement', () => {
  const valide = { criminal_id: 1, location: 'Montréal' };

  test.each([
    ['criminal_id en lettres', { criminal_id: 'abc' }, /criminal_id doit être un identifiant numérique/],
    ['criminal_id décimal', { criminal_id: 1.5 }, /criminal_id doit être un identifiant numérique/],
    ['criminal_id négatif', { criminal_id: -3 }, /criminal_id doit être un identifiant numérique/],
    ['criminal_id en objet', { criminal_id: { id: 1 } }, /criminal_id doit être un identifiant numérique/],
    ['criminal_id hors des entiers de PostgreSQL', { criminal_id: 2147483648 }, /criminal_id doit être un identifiant numérique/],
    ['lieu invisible', { location: INVISIBLE }, /criminal_id et location sont obligatoires/],
    ['lieu en objet', { location: { rue: 'Berri' } }, /criminal_id et location sont obligatoires/],
    ['lieu de 256 caractères', { location: LONG(256) }, /lieu dépasse 255 caractères/],
    ['notes en nombre', { notes: 5 }, /notes doivent être un texte/],
    ['notes de 2 001 caractères', { notes: LONG(2001) }, /notes dépassent 2000 caractères/],
    ['latitude sans longitude', { latitude: 45.5 }, /latitude .* longitude/],
  ])('400 : %s', async (_cas, champs, message) => {
    await expectRefus('post', '/api/sightings', 'policier', { ...valide, ...champs }, message);
  });

  test.each(['abc', '1.5', '0'])('GET ?criminal_id=%s : 400, sans requête SQL', async (id) => {
    const res = await request(app)
      .get(`/api/sightings?criminal_id=${id}`)
      .set('Authorization', bearer('superviseur'));
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('criminal_id doit être un identifiant numérique');
    expect(query).not.toHaveBeenCalled();
  });
});

describe('POST /api/users : création d\'un compte', () => {
  const valide = {
    first_name: 'Marc', last_name: 'Roy', badge_number: 'PL-050', email: 'marc.roy@crimetracker.local',
    password: 'MotDePasse1', role: 'policier', grade: 'sergent_autres_fonctions',
  };
  const creer = (champs, message) => expectRefus('post', '/api/users', 'superviseur', { ...valide, ...champs }, message);

  test.each([
    ['prénom invisible', { first_name: INVISIBLE }, /obligatoires/],
    ['prénom en nombre', { first_name: 12 }, /obligatoires/],
    ['prénom de 101 caractères', { first_name: LONG(101) }, /first_name ne doit pas dépasser 100 caractères/],
    ['nom invisible', { last_name: INVISIBLE }, /obligatoires/],
    ['nom de 101 caractères', { last_name: LONG(101) }, /last_name ne doit pas dépasser 100 caractères/],
    ['matricule invisible', { badge_number: INVISIBLE }, /obligatoires/],
    ['matricule de 21 caractères', { badge_number: LONG(21) }, /badge_number ne doit pas dépasser 20 caractères/],
    ['courriel invalide', { email: 'pas-un-courriel' }, /courriel est invalide/],
    ['courriel de 256 caractères', { email: `${LONG(244)}@exemple.com` }, /email ne doit pas dépasser 255 caractères/],
    ['mot de passe en objet', { password: { valeur: 'MotDePasse1' } }, /au moins 8 caractères/],
    ['mot de passe de 7 caractères', { password: 'Court1!' }, /au moins 8 caractères/],
    ['mot de passe de 73 octets (bcrypt ignore la suite)', { password: LONG(73) }, /trop long \(72 octets au plus/],
    ['rôle en tableau', { role: ['policier'] }, /Rôle invalide/],
    ['grade inconnu', { grade: 'general' }, /Grade invalide/],
  ])('400 : %s', async (_cas, champs, message) => {
    await creer(champs, message);
  });
});

describe('POST /api/auth/login et /api/auth/change-password', () => {
  test.each([
    ['matricule en objet', { badge_number: { $ne: null }, password: 'Alpha2026!' }],
    ['mot de passe en objet', { badge_number: 'PL-003', password: { valeur: 'x' } }],
    ['mot de passe en nombre', { badge_number: 'PL-003', password: 12345678 }],
  ])('connexion, 400 : %s (bcrypt plantait : 500)', async (_cas, body) => {
    // Seul le compteur de tentatives (limite de connexion) touche la base; jamais le compte
    query.mockImplementation(async (sql) => {
      if (sql.includes('login_rate_limit')) return { rows: [{ failed_attempts: 1 }] };
      throw new Error(`Requête inattendue : ${sql}`);
    });
    const res = await request(app).post('/api/auth/login').send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Le matricule et le mot de passe sont requis');
    expect(query.mock.calls.some(([sql]) => sql.includes('app_user'))).toBe(false);
  });

  test.each([
    ['ancien mot de passe en objet', { old_password: { a: 1 }, new_password: 'NouveauMotDePasse1' }, /sont requis/],
    ['nouveau mot de passe en nombre', { old_password: 'Ancien123', new_password: 123456789 }, /sont requis/],
    ['nouveau mot de passe de 7 caractères', { old_password: 'Ancien123', new_password: 'Court1!' }, /au moins 8 caractères/],
    ['nouveau mot de passe de 73 octets', { old_password: 'Ancien123', new_password: LONG(73) }, /trop long \(72 octets au plus/],
    ['72 octets dépassés avec des accents', { old_password: 'Ancien123', new_password: 'é'.repeat(37) }, /trop long/],
  ])('changement, 400 : %s', async (_cas, body, message) => {
    await expectRefus('post', '/api/auth/change-password', 'policier', body, message);
  });
});
