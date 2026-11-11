/**
 * Politique de sécurité du contenu (CSP) envoyée par nginx (frontend/nginx.conf.template) :
 * présente sur les pages et sur les fichiers compilés, sans script en ligne permis,
 * et absente de la documentation Swagger (fermée en production), qui a besoin de scripts en ligne.
 * Un retrait ou un affaiblissement par erreur rend la CI rouge.
 */
import { describe, test, expect } from '@jest/globals';
import { readFile } from 'node:fs/promises';

const conf = await readFile(new URL('../../../../frontend/nginx.conf.template', import.meta.url), 'utf8');
const csps = [...conf.matchAll(/add_header Content-Security-Policy "([^"]+)" always;/g)].map((m) => m[1]);
const bloc = (debut) => {
  const i = conf.indexOf(debut);
  return conf.slice(i, conf.indexOf('\n    }', i));
};
const directives = (csp) => Object.fromEntries(csp.split(';').map((d) => d.trim()).filter(Boolean)
  .map((d) => { const [nom, ...valeurs] = d.split(/\s+/); return [nom, valeurs]; }));

describe('CSP de nginx', () => {
  test('envoyée pour les pages et pour les fichiers compilés, identique aux deux endroits', () => {
    expect(csps).toHaveLength(2);
    expect(csps[0]).toBe(csps[1]);
    expect(bloc('location /assets/')).toContain('Content-Security-Policy');
  });

  test('aucun script en ligne ni venu d\'ailleurs; pas d\'objet; pas d\'intégration dans un cadre', () => {
    const d = directives(csps[0]);
    expect(d['default-src']).toEqual(["'self'"]);
    expect(d['script-src']).toEqual(["'self'"]);
    expect(d['object-src']).toEqual(["'none'"]);
    expect(d['frame-ancestors']).toEqual(["'none'"]);
    expect(d['base-uri']).toEqual(["'self'"]);
    expect(csps[0]).not.toMatch(/unsafe-eval/);
  });

  test('permet ce que l\'application utilise : polices Google, tuiles OpenStreetMap, WebSocket du site', () => {
    const d = directives(csps[0]);
    expect(d['font-src']).toContain('https://fonts.gstatic.com');
    expect(d['style-src']).toContain('https://fonts.googleapis.com');
    expect(d['img-src']).toContain('https://tile.openstreetmap.org');
    expect(d['connect-src']).toEqual(["'self'"]);
    expect(d['media-src']).toContain('blob:'); // messages vocaux
  });

  test('la documentation Swagger garde ses propres en-têtes, sans la CSP', () => {
    const swagger = bloc('location /api-docs');
    expect(swagger).not.toContain('Content-Security-Policy');
    expect(swagger).toContain('X-Frame-Options');
  });
});
