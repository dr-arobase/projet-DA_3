/**
 * #101 : le fichier .env doit être lu AVANT que config/db.js choisisse la base.
 * Avant, dotenv.config() s'exécutait après les imports : DATABASE_URL de .env était ignorée
 * et l'API tentait toujours le PostgreSQL par défaut (localhost:5432).
 * On lance un vrai Node dans un dossier qui contient un .env, sans DATABASE_URL dans l'environnement.
 */
import { describe, test, expect } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dbJs = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/config/db.js')).href;

describe('chargement du .env', () => {
  test('DATABASE_URL du fichier .env choisit bien la base', () => {
    const dossier = mkdtempSync(path.join(tmpdir(), 'ct-env-'));
    writeFileSync(path.join(dossier, '.env'), 'DATABASE_URL=sqlite::memory:\n');
    const env = { ...process.env };
    delete env.DATABASE_URL;

    try {
      const sortie = execFileSync(process.execPath, [
        '--no-warnings', '--input-type=module', '-e',
        `const { pool } = await import(${JSON.stringify(dbJs)});
         const { rows } = await pool.query("SELECT sqlite_version() IS NOT NULL AS sqlite");
         console.log(JSON.stringify(rows[0]));`,
      ], { cwd: dossier, env, encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] });

      expect(JSON.parse(sortie.trim())).toEqual({ sqlite: 1 });
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
});
