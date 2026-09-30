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

test('GET / retourne un statut 200 et confirme que l’API fonctionne', async () => {
  const response = await api.request('GET', '/');
  assert.equal(response.status, 200);
  assert.match(response.data.message, /API CrimeTracker opérationnelle|Serveur CrimeTracker opérationnel/);
});

test('GET /api-docs/ retourne la documentation Swagger', async () => {
  const response = await api.request('GET', '/api-docs/');
  assert.equal(response.status, 200);
  assert.match(response.data, /swagger-ui/);
});
/*
test('les comptes de test de chaque rôle peuvent se connecter', async () => {
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
*/