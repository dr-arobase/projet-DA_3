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

test('POST /api/sightings refuse les champs obligatoires manquants', async () => {
  const response = await api.request('POST', '/api/sightings', {}, api.tokenFor());
  assert.equal(response.status, 400);
});

test('POST /api/sightings crée un signalement lié au compte authentifié', async () => {
  const response = await api.request('POST', '/api/sightings', {
    criminal_id: 1,
    location: 'Station de test',
    notes: 'Observation de test'
  }, api.tokenFor());

  assert.equal(response.status, 201);
  assert.equal(response.data.sighting.criminal_id, 1);
  assert.equal(response.data.sighting.location, 'Station de test');
});

test('GET /api/sightings exige le rôle superviseur et le paramètre criminal_id', async () => {
  const denied = await api.request('GET', '/api/sightings?criminal_id=1', undefined, api.tokenFor('policier'));
  assert.equal(denied.status, 403);

  const missingId = await api.request('GET', '/api/sightings', undefined, api.tokenFor('superviseur'));
  assert.equal(missingId.status, 400);
});

test('GET /api/sightings retourne les signalements du dossier', async () => {
  const response = await api.request('GET', '/api/sightings?criminal_id=1', undefined, api.tokenFor('superviseur'));
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.data));
  assert.ok(response.data.some((sighting) => sighting.location === 'Station de test'));
});