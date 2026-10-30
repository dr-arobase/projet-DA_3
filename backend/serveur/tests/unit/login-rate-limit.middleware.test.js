import { describe, test, expect, beforeAll, beforeEach, afterAll, afterEach, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

process.env.DATABASE_URL = 'sqlite::memory:';
process.env.JWT_SECRET = 'test-secret';

const { pool, closeDatabase } = await import('../../src/config/db.js');
const { limitLoginAttempts } = await import('../../src/middleware/login-rate-limit.middleware.js');

const createApp = () => {
  const app = express();
  app.set('trust proxy', 1);
  app.post('/login', limitLoginAttempts, (req, res) => {
    if (req.get('x-test-login') === 'success') {
      return res.status(200).json({ message: 'ok' });
    }
    return res.status(401).json({ message: 'invalid' });
  });
  return app;
};

const firstApi = createApp();
const secondApi = createApp();
const attempt = (app, ip, successful = false) => {
  const req = request(app).post('/login').set('X-Forwarded-For', ip);
  return successful ? req.set('X-Test-Login', 'success').send({}) : req.send({});
};

let now;

beforeAll(async () => {
  await pool.query(`
    CREATE TABLE login_rate_limit (
      client_key TEXT PRIMARY KEY,
      window_start INTEGER NOT NULL,
      failed_attempts INTEGER NOT NULL
    )
  `);
});

beforeEach(async () => {
  await pool.query('DELETE FROM login_rate_limit');
  now = jest.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
});

afterEach(() => {
  now.mockRestore();
});

afterAll(async () => {
  await closeDatabase();
});

describe('limitation des tentatives de connexion', () => {
  test('répond 429 à la sixième tentative échouée et indique le délai', async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await attempt(firstApi, '198.51.100.10')).status).toBe(401);
    }

    const response = await attempt(firstApi, '198.51.100.10');

    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toMatch(/^\d+$/);
    expect(response.body.message).toMatch(/Trop de tentatives/);
  });

  test('ne compte pas une connexion réussie dans les cinq échecs autorisés', async () => {
    for (let i = 0; i < 4; i += 1) {
      expect((await attempt(firstApi, '198.51.100.11')).status).toBe(401);
    }

    expect((await attempt(firstApi, '198.51.100.11', true)).status).toBe(200);
    await new Promise((resolve) => setImmediate(resolve));
    expect((await attempt(firstApi, '198.51.100.11')).status).toBe(401);
    expect((await attempt(firstApi, '198.51.100.11')).status).toBe(429);
  });

  test('partage le compteur entre deux instances et sépare les adresses IP', async () => {
    for (let i = 0; i < 3; i += 1) {
      expect((await attempt(firstApi, '198.51.100.12')).status).toBe(401);
    }
    for (let i = 0; i < 2; i += 1) {
      expect((await attempt(secondApi, '198.51.100.12')).status).toBe(401);
    }

    expect((await attempt(firstApi, '198.51.100.12')).status).toBe(429);
    expect((await attempt(secondApi, '198.51.100.13')).status).toBe(401);
  });

  test('réinitialise le compteur après la fenêtre de quinze minutes', async () => {
    for (let i = 0; i < 5; i += 1) {
      await attempt(firstApi, '198.51.100.14');
    }
    expect((await attempt(firstApi, '198.51.100.14')).status).toBe(429);

    now.mockReturnValue(1_800_000_000_000 + 15 * 60 * 1000);

    expect((await attempt(firstApi, '198.51.100.14')).status).toBe(401);
  });
});
