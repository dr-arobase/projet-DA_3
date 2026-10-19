/**
 * Service de géocodage (Nominatim) : requête envoyée, cache, service en panne.
 * fetch est simulé : aucun appel réseau.
 */
import { jest, describe, test, expect, beforeEach, afterAll } from '@jest/globals';

const fetchOriginal = globalThis.fetch;
const fetchSimule = jest.fn();
globalThis.fetch = fetchSimule;

const { geocode, geocodeOrNull } = await import('../../src/services/geocoding.service.js');

const reponse = (corps, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => corps });

beforeEach(() => fetchSimule.mockReset());
afterAll(() => { globalThis.fetch = fetchOriginal; });

describe('services/geocoding', () => {
  test('interroge Nominatim au Canada, en français, avec un User-Agent qui identifie l\'application', async () => {
    fetchSimule.mockResolvedValue(reponse([{ lat: '45.5', lon: '-73.56', display_name: 'Montréal' }]));

    const position = await geocode('1 rue Sherbrooke, Montréal');

    expect(position).toEqual({ latitude: 45.5, longitude: -73.56, display_name: 'Montréal' });
    const [url, options] = fetchSimule.mock.calls[0];
    expect(url.searchParams.get('q')).toBe('1 rue Sherbrooke, Montréal');
    expect(url.searchParams.get('countrycodes')).toBe('ca');
    expect(options.headers['User-Agent']).toMatch(/CrimeTracker/);
  });

  test('une adresse déjà cherchée n\'est pas redemandée (majuscules et espaces ignorés)', async () => {
    fetchSimule.mockResolvedValue(reponse([{ lat: '45.6', lon: '-73.6', display_name: 'Laval' }]));

    await geocode('Cache Laval');
    const deuxieme = await geocode('  cache laval ');

    expect(fetchSimule).toHaveBeenCalledTimes(1);
    expect(deuxieme.latitude).toBe(45.6);
  });

  test('aucun résultat : null', async () => {
    fetchSimule.mockResolvedValue(reponse([]));
    expect(await geocode('Adresse inexistante 999')).toBeNull();
  });

  test('service en panne : GEOCODER_UNAVAILABLE, ou null avec geocodeOrNull', async () => {
    fetchSimule.mockResolvedValue(reponse({}, false));
    await expect(geocode('Panne un')).rejects.toThrow('GEOCODER_UNAVAILABLE');

    fetchSimule.mockRejectedValue(new Error('réseau coupé'));
    expect(await geocodeOrNull('Panne deux')).toBeNull();
  });
});
