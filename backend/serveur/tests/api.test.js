// Pages web, documentation Swagger et erreurs génériques
import request from 'supertest';
import fs from 'node:fs';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { loginAs, resetDatabase } from './helpers.js';

const swagger = JSON.parse(fs.readFileSync(new URL('../src/swagger.json', import.meta.url), 'utf8'));

beforeAll(resetDatabase);
afterAll(() => pool.end());

describe('pages web', () => {
  test('la page de connexion est publique', async () => {
    const res = await request(app).get('/login');
    expect(res.status).toBe(200);
    expect(res.text).toContain('id="login-form"');
  });

  test.each(['/', '/criminals', '/criminals/new', '/criminals/1'])(
    '%s sans être connecté : redirection vers /login', async (path) => {
      const res = await request(app).get(path);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/login');
    });

  test.each([
    ['/', 'Tableau de bord'],
    ['/criminals', 'Registre'],
    ['/criminals/new', 'Ajouter un dossier'],
    ['/criminals/1', 'Dossier'],
  ])('%s une fois connecté : la page est servie', async (path, title) => {
    const agent = await loginAs('PL-003');
    const res = await agent.get(path);
    expect(res.status).toBe(200);
    expect(res.text).toContain(`<title>${title}`);
  });

  test('adresse inconnue : page 404', async () => {
    const res = await request(app).get('/nimporte-quoi');
    expect(res.status).toBe(404);
    expect(res.text).toContain('Page introuvable');
  });

  test('les scripts de l\'interface sont servis', async () => {
    const res = await request(app).get('/assets/app.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/javascript/);
  });
});

describe('API', () => {
  test('route d\'API inconnue : 404 en JSON', async () => {
    const res = await request(app).get('/api/inconnue');
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Route inconnue/);
  });

  test('GET /health', async () => {
    expect((await request(app).get('/health')).body).toEqual({ status: 'ok' });
  });
});

describe('documentation Swagger', () => {
  test('l\'interface est servie sur /api-docs/', async () => {
    const res = await request(app).get('/api-docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });

  test('la spécification OpenAPI est servie sur /api-docs.json', async () => {
    const res = await request(app).get('/api-docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
  });

  // Chaque opération documentée existe vraiment dans l'application (jamais la 404 « Route inconnue »).
  const operations = Object.entries(swagger.paths).flatMap(([path, item]) =>
    ['get', 'post', 'patch', 'delete'].filter((m) => item[m]).map((m) => [m.toUpperCase(), path]));

  test.each(operations)('%s %s est implémentée', async (method, path) => {
    const res = await request(app)[method.toLowerCase()](path.replace('{id}', '1'));
    expect(res.status).not.toBe(404);
  });

  test('toutes les routes du registre sont documentées', () => {
    expect(Object.keys(swagger.paths)).toEqual(expect.arrayContaining([
      '/auth/login', '/auth/logout', '/auth/me', '/api/criminals', '/api/criminals/{id}',
    ]));
    expect(Object.keys(swagger.paths['/api/criminals/{id}'])).toEqual(
      expect.arrayContaining(['get', 'patch', 'delete']));
  });
});
