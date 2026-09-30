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

test('GET /api/audit-logs refuse les requêtes sans authentification', async () => {
  assert.equal((await api.request('GET', '/api/audit-logs')).status, 401);
});

test('GET /api/audit-logs est réservé à la direction', async () => {
  const denied = await api.request('GET', '/api/audit-logs', undefined, api.tokenFor('superviseur'));
  assert.equal(denied.status, 403);

  const allowed = await api.request('GET', '/api/audit-logs?page=1&limit=10', undefined, api.tokenFor('direction'));
  assert.equal(allowed.status, 200);
  assert.equal(allowed.data.page, 1);
  assert.ok(Array.isArray(allowed.data.data));
});