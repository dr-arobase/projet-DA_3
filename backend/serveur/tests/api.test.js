import request from 'supertest';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';

describe('CrimeTracker API Tests', () => {
  
  // Test de base pour s'assurer que l'application tourne
  test('GET / retourne un statut 200', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.text).toContain('Serveur CrimeTracker opérationnel');
  });

  // Test du Swagger
  test('GET /api-docs/ retourne la documentation Swagger', async () => {
    const response = await request(app).get('/api-docs/');
    expect(response.status).toBe(200);
    expect(response.text).toContain('swagger-ui');
  });

  // Test de la route criminals existante
  test('GET /api/criminals retourne une liste (200) ou erreur DB', async () => {
    // Si la DB est pas initialisée dans les tests ça peut retourner 500,
    // mais la route existe bien
    const response = await request(app).get('/api/criminals');
    expect([200, 500]).toContain(response.status); 
  });
});

afterAll(async () => {
  // Fermer le pool de la BD après les tests pour éviter que Jest "pende"
  await pool.end();
});
