/**
 * Service GitHub (arctic) : l'adresse d'autorisation, sans appel réseau.
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { isConfigured, authorizationUrl } from '../../src/services/github.service.js';

beforeEach(() => {
  process.env.GITHUB_CLIENT_ID = 'id-de-test';
  process.env.GITHUB_CLIENT_SECRET = 'secret-de-test';
  delete process.env.GITHUB_CALLBACK_URL;
});

describe('services/github', () => {
  test('isConfigured exige l\'identifiant ET le secret', () => {
    expect(isConfigured()).toBe(true);
    delete process.env.GITHUB_CLIENT_SECRET;
    expect(isConfigured()).toBe(false);
  });

  test('l\'adresse d\'autorisation porte le client, le state et l\'adresse de retour, jamais le secret', () => {
    const { state, url } = authorizationUrl();
    const adresse = new URL(url);

    expect(adresse.origin + adresse.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(adresse.searchParams.get('client_id')).toBe('id-de-test');
    expect(adresse.searchParams.get('state')).toBe(state);
    expect(adresse.searchParams.get('redirect_uri')).toBe('http://localhost:8080/api/auth/github/callback');
    expect(url).not.toContain('secret-de-test');
  });

  test('chaque départ a un state différent', () => {
    expect(authorizationUrl().state).not.toBe(authorizationUrl().state);
  });

  test('GITHUB_CALLBACK_URL remplace l\'adresse de retour par défaut', () => {
    process.env.GITHUB_CALLBACK_URL = 'http://localhost:5173/api/auth/github/callback';
    const adresse = new URL(authorizationUrl().url);
    expect(adresse.searchParams.get('redirect_uri')).toBe('http://localhost:5173/api/auth/github/callback');
  });
});
