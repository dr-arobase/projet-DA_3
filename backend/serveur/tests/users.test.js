import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { validationResult } from 'express-validator';
import { validateCreateUser } from '../src/utils/validators.js';
import { startServer } from './helper.js';

let api;
before(async () => {
  api = await startServer();
});

after(async () => {
  await api?.close();
});

async function validateUser(body) {
  const req = { body, params: {}, query: {} };
  await Promise.all(validateCreateUser.map((validator) => validator.run(req)));
  return validationResult(req).array();
}

const validPoliceAccount = {
  first_name: 'Jean',
  last_name: 'Eren',
  badge_number: 'PL-003',
  email: 'eren@site.com',
  password: 'motdepasse123',
  role: 'policier',
  grade: 'sergent_autres_fonctions',
  is_active: true
};

test('un compte policier valide est accepté', async () => {
  assert.deepEqual(await validateUser(validPoliceAccount), []);
});

test('un compte avec un grade incompatible avec le rôle est rejeté', async () => {
  const errors = await validateUser({
    ...validPoliceAccount,
    grade: 'lieutenant'
  });

  assert.ok(errors.some((error) => error.msg.includes('ne correspond pas au rôle')));
});

test('la création d’un compte non policier est refusée', async () => {
  const errors = await validateUser({
    ...validPoliceAccount,
    role: 'direction',
    grade: 'directeur_general'
  });

  assert.ok(errors.some((error) => error.path === 'role'));
});

test('les routes de consultation des utilisateurs appliquent leurs permissions', async () => {
  assert.equal((await api.request('GET', '/api/users')).status, 401);

  const forbidden = await api.request('GET', '/api/users', undefined, api.tokenFor('policier'));
  assert.equal(forbidden.status, 403);

  const list = await api.request('GET', '/api/users', undefined, api.tokenFor('superviseur'));
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.data));
  assert.ok(list.data.every((user) => !Object.hasOwn(user, 'password_hash')));

  const detail = await api.request('GET', `/api/users/${api.users.policier.id}`, undefined, api.tokenFor('superviseur'));
  assert.equal(detail.status, 200);
  assert.equal(detail.data.role, 'policier');

  const missing = await api.request('GET', '/api/users/999999', undefined, api.tokenFor('superviseur'));
  assert.equal(missing.status, 404);
});

test('les routes de création, statut et promotion utilisateur fonctionnent', async () => {
  const supervisorToken = api.tokenFor('superviseur');
  const payload = {
    first_name: 'Test',
    last_name: 'Utilisateur',
    badge_number: api.users.policier.badge_number.replace('POL', 'NEW'),
    email: `new.${api.users.policier.email}`,
    password: 'motdepasse123'
  };

  assert.equal((await api.request('POST', '/api/users', payload, api.tokenFor('policier'))).status, 403);

  const created = await api.request('POST', '/api/users', payload, supervisorToken);
  assert.equal(created.status, 201);
  assert.equal(created.data.user.role, 'policier');
  assert.equal(Object.hasOwn(created.data.user, 'password_hash'), false);

  const duplicate = await api.request('POST', '/api/users', payload, supervisorToken);
  assert.equal(duplicate.status, 409);

  const id = created.data.user.id;
  const deactivated = await api.request('PATCH', `/api/users/${id}/deactivate`, {}, supervisorToken);
  assert.equal(deactivated.status, 200);
  assert.equal(deactivated.data.user.is_active, false);

  const reactivated = await api.request('PATCH', `/api/users/${id}/reactivate`, {}, supervisorToken);
  assert.equal(reactivated.status, 200);
  assert.equal(reactivated.data.user.is_active, true);

  const promotion = await api.request('PATCH', `/api/users/${id}/promote`, {
    role: 'superviseur',
    grade: 'lieutenant'
  }, api.tokenFor('direction'));
  assert.equal(promotion.status, 200);
  assert.equal(promotion.data.user.role, 'superviseur');
  assert.equal(promotion.data.user.grade, 'lieutenant');
});