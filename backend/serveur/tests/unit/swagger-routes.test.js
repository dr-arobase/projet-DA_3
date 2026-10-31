/**
 * #99 : chaque route montée dans app.js doit être documentée dans swagger.json.
 * Les routes sont lues dans le code (app.use + router.get/post/…) : une route ajoutée
 * sans sa documentation fait échouer ce test.
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';

const src = (fichier) => readFileSync(new URL(`../../src/${fichier}`, import.meta.url), 'utf8');

// Même forme des deux côtés : /api/x/:id et /api/x/{id} deviennent /api/x/{}
const normaliser = (chemin) => chemin.replace(/:\w+|\{\w+\}/g, '{}');

function routesDuCode() {
  const app = src('app.js');
  const fichiers = Object.fromEntries([...app.matchAll(/import (\w+) from '\.\/routes\/([\w.]+)'/g)].map((m) => [m[1], m[2]]));
  const routes = [];
  for (const [, base, variable] of app.matchAll(/app\.use\('(\/api[^']*)',\s*(\w+)\)/g)) {
    const code = src(`routes/${fichiers[variable]}`);
    for (const [, methode, chemin] of code.matchAll(/router\.(get|post|put|patch|delete)\('([^']*)'/g)) {
      routes.push(`${methode.toUpperCase()} ${normaliser(base + (chemin === '/' ? '' : chemin))}`);
    }
  }
  return routes;
}

describe('documentation Swagger', () => {
  const swagger = JSON.parse(src('swagger.json'));
  const documentees = new Set(Object.entries(swagger.paths)
    .flatMap(([chemin, ops]) => Object.keys(ops).filter((m) => m !== 'parameters')
      .map((m) => `${m.toUpperCase()} ${normaliser(chemin)}`)));

  test('le code déclare bien des routes (le test lit les bons fichiers)', () => {
    expect(routesDuCode().length).toBeGreaterThan(30);
  });

  test('toutes les routes de l\'API sont documentées', () => {
    expect(routesDuCode().filter((r) => !documentees.has(r))).toEqual([]);
  });
});
