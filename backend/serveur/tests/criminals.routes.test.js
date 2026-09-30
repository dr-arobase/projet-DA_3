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

test('GET /api/criminals refuse les requêtes sans authentification', async () => {
  assert.equal((await api.request('GET', '/api/criminals')).status, 401);
});

test('GET /api/criminals retourne une liste paginée', async () => {
  const response = await api.request('GET', '/api/criminals?page=1&limit=5', undefined, api.tokenFor());
  assert.equal(response.status, 200);
  assert.equal(response.data.page, 1);
  assert.equal(response.data.limit, 5);
  assert.ok(response.data.total >= 1);
  assert.ok(Array.isArray(response.data.data));
});

test('GET /api/criminals/:id retourne le dossier seedé', async () => {
  const response = await api.request('GET', '/api/criminals/1', undefined, api.tokenFor());
  assert.equal(response.status, 200);
  assert.equal(response.data.first_name, 'Jean');
  assert.equal(response.data.last_name, 'Dupont');
});

test('GET /api/criminals/:id retourne 404 pour un dossier absent', async () => {
  const response = await api.request('GET', '/api/criminals/999999', undefined, api.tokenFor());
  assert.equal(response.status, 404);
});

test('POST /api/criminals refuse les noms manquants', async () => {
  const response = await api.request('POST', '/api/criminals', {}, api.tokenFor());
  assert.equal(response.status, 400);
});

test('POST /api/criminals crée un dossier et PATCH modifie son statut', async () => {
  const token = api.tokenFor();
  const created = await api.request('POST', '/api/criminals', {
    first_name: 'Camille',
    last_name: 'Test',
    status: 'RECHERCHE'
  }, token);

  assert.equal(created.status, 201);
  const id = created.data.criminal.id;
  assert.ok(id);

  const changed = await api.request('PATCH', `/api/criminals/${id}/status`, {
    status: 'CAPTURE',
    version: created.data.criminal.version
  }, token);
  assert.equal(changed.status, 200);
  assert.equal(changed.data.criminal.status, 'CAPTURE');
});

test('PUT /api/criminals/:id met à jour un dossier existant', async () => {
  const response = await api.request('PUT', '/api/criminals/1', {
    first_name: 'Jean',
    last_name: 'Dupont',
    nationality: 'Canadienne'
  }, api.tokenFor());

  assert.equal(response.status, 200);
  assert.equal(response.data.criminal.nationality, 'Canadienne');
});

test('PATCH /api/criminals/:id/status exige une version', async () => {
  const response = await api.request('PATCH', '/api/criminals/1/status', {
    status: 'CAPTURE'
  }, api.tokenFor());
  assert.equal(response.status, 400);
});

test('DELETE /api/criminals/:id est réservé au superviseur', async () => {
  const response = await api.request('DELETE', '/api/criminals/1', undefined, api.tokenFor('policier'));
  assert.equal(response.status, 403);
});

test('DELETE /api/criminals/:id retourne 404 pour un dossier absent', async () => {
  const response = await api.request('DELETE', '/api/criminals/999999', undefined, api.tokenFor('superviseur'));
  assert.equal(response.status, 404);
});