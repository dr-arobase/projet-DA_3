import { createHmac } from 'node:crypto';
import { pool } from '../config/db.js';
import { assertJwtSecret } from '../utils/jwt.js';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

const UPSERT_ATTEMPT = `
  INSERT INTO login_rate_limit (client_key, window_start, failed_attempts)
  VALUES ($1, $2, 1)
  ON CONFLICT (client_key) DO UPDATE SET
    window_start = EXCLUDED.window_start,
    failed_attempts = CASE
      WHEN login_rate_limit.window_start = EXCLUDED.window_start
        THEN CASE
          WHEN login_rate_limit.failed_attempts < $3
            THEN login_rate_limit.failed_attempts + 1
          ELSE login_rate_limit.failed_attempts
        END
      ELSE 1
    END
  RETURNING failed_attempts
`;

const RELEASE_SUCCESSFUL_ATTEMPT = `
  UPDATE login_rate_limit
  SET failed_attempts = CASE
    WHEN failed_attempts > 0 THEN failed_attempts - 1
    ELSE 0
  END
  WHERE client_key = $1 AND window_start = $2
`;

export async function limitLoginAttempts(req, res, next) {
  try {
    assertJwtSecret();
    if (typeof req.ip !== 'string' || req.ip.length === 0) {
      throw new Error('Adresse IP client introuvable pour limiter les connexions.');
    }

    const windowStart = Math.floor(Date.now() / WINDOW_MS);
    const clientKey = createHmac('sha256', process.env.JWT_SECRET)
      .update(req.ip)
      .digest('hex');

    await pool.query('DELETE FROM login_rate_limit WHERE window_start < $1', [windowStart]);
    const { rows } = await pool.query(UPSERT_ATTEMPT, [
      clientKey,
      windowStart,
      MAX_FAILED_ATTEMPTS + 1,
    ]);
    const attempts = rows[0]?.failed_attempts;
    if (typeof attempts !== 'number') {
      throw new Error('Le compteur de tentatives de connexion est absent.');
    }

    if (attempts > MAX_FAILED_ATTEMPTS) {
      const retryAfter = Math.max(
        1,
        Math.ceil(((windowStart + 1) * WINDOW_MS - Date.now()) / 1000)
      );
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        message: 'Trop de tentatives de connexion. Réessayez plus tard.',
      });
    }

    res.once('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        void pool.query(RELEASE_SUCCESSFUL_ATTEMPT, [clientKey, windowStart])
          .catch((error) => {
            console.error('Impossible de libérer le compteur après une connexion réussie:', error);
          });
      }
    });

    return next();
  } catch (error) {
    return next(error);
  }
}
