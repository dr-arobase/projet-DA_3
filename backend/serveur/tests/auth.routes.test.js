import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helper.js';

let api;
before(async () => {
  api = await startServer();
});

after(async () => {
  await api?.close();
});

test('POST /auth/login refuse les champs manquants', async () => {
  const response = await api.request('POST', '/auth/login', {});
  assert.equal(response.status, 400);
});

test('POST /auth/login authentifie les comptes temporaires de chaque rôle', async () => {
  for (const role of ['policier', 'superviseur', 'direction']) {
    const account = api.users[role];
    const response = await api.request('POST', '/auth/login', {
      badge_number: account.badge_number,
      password: account.password
    });

    assert.equal(response.status, 200, `connexion ${role}`);
    assert.equal(response.data.user.role, role);
    assert.equal(typeof response.data.token, 'string');
  }
});

test('GET /auth/me refuse un jeton absent et accepte un jeton valide', async () => {
  assert.equal((await api.request('GET', '/auth/me')).status, 401);

  const response = await api.request('GET', '/auth/me', undefined, api.tokenFor('policier'));
  assert.equal(response.status, 200);
  assert.equal(response.data.user.role, 'policier');
});