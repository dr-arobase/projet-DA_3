// Compte rapide de l'équipe (1 / 2) : créé en local, jamais en production (COMPTE_EQUIPE=false, décision 18)
import { jest, describe, test, expect, beforeEach, afterAll } from '@jest/globals';

const requetes = [];
let nombreComptes = 1;
const query = jest.fn(async (sql) => {
  requetes.push(sql);
  if (/SELECT COUNT\(\*\) AS n FROM app_user/.test(sql)) return { rows: [{ n: nombreComptes }] };
  return { rows: [] };
});

jest.unstable_mockModule('pg', () => ({
  default: {
    Pool: class { query = query; },
    types: { setTypeParser: () => {}, builtins: { INT8: 20 } },
  },
}));

const { initializeDatabase } = await import('../../src/config/db-postgres.js');

// L'ajout au démarrage (pas seed.sql, qui contient aussi ce compte) : une seule requête, ON CONFLICT DO NOTHING
const creeLeCompte = () => requetes.some((sql) => sql.trim().startsWith('INSERT INTO app_user')
  && sql.includes("'equipe@crimetracker.local'") && sql.includes('ON CONFLICT DO NOTHING'));
const desactiveLeCompte = () => requetes.some((sql) => /UPDATE app_user SET is_active = FALSE WHERE badge_number = '1'/.test(sql));
const avant = process.env.COMPTE_EQUIPE;

describe('compte rapide de l\'équipe', () => {
  beforeEach(() => {
    requetes.length = 0;
    query.mockClear();
    delete process.env.COMPTE_EQUIPE;
  });
  afterAll(() => {
    if (avant === undefined) delete process.env.COMPTE_EQUIPE;
    else process.env.COMPTE_EQUIPE = avant;
  });

  test('en local (sans réglage), il est ajouté s\'il manque', async () => {
    nombreComptes = 5;
    await initializeDatabase();
    expect(creeLeCompte()).toBe(true);
  });

  test('en production (COMPTE_EQUIPE=false), il n\'est pas ajouté à une base existante', async () => {
    process.env.COMPTE_EQUIPE = 'false';
    nombreComptes = 5;
    await initializeDatabase();
    expect(creeLeCompte()).toBe(false);
    expect(desactiveLeCompte()).toBe(false);
  });

  test('en production, une base neuve le désactive juste après les données de départ', async () => {
    process.env.COMPTE_EQUIPE = 'false';
    nombreComptes = 0;
    await initializeDatabase();
    expect(desactiveLeCompte()).toBe(true);
    expect(creeLeCompte()).toBe(false);
  });

  test('en local, une base neuve le garde actif', async () => {
    nombreComptes = 0;
    await initializeDatabase();
    expect(desactiveLeCompte()).toBe(false);
  });
});
