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

test('GET /api/alerts exige une authentification et retourne les alertes', async () => {
  assert.equal((await api.request('GET', '/api/alerts')).status, 401);

  const response = await api.request('GET', '/api/alerts', undefined, api.tokenFor());
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.data.data));
});

test('POST /api/alerts est réservé au superviseur et valide le message', async () => {
  const denied = await api.request('POST', '/api/alerts', { message: 'test' }, api.tokenFor('policier'));
  assert.equal(denied.status, 403);

  const missingMessage = await api.request('POST', '/api/alerts', {}, api.tokenFor('superviseur'));
  assert.equal(missingMessage.status, 400);

  const invalidSeverity = await api.request('POST', '/api/alerts', {
    message: 'Alerte test',
    severity: 'critique'
  }, api.tokenFor('superviseur'));
  assert.equal(invalidSeverity.status, 400);
});

test('POST /api/alerts diffuse une alerte valide', async () => {
  const response = await api.request('POST', '/api/alerts', {
    message: 'Alerte de test',
    severity: 'urgent',
    criminal_id: 1
  }, api.tokenFor('superviseur'));

  assert.equal(response.status, 201);
  assert.equal(response.data.alert.message, 'Alerte de test');
  assert.equal(response.data.alert.severity, 'urgent');
});