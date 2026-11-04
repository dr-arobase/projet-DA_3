/**
 * Service de géocodage (Nominatim) : requête envoyée, cache, service en panne.
 * fetch est simulé : aucun appel réseau.
 */
import { jest, describe, test, expect, beforeEach, afterAll } from '@jest/globals';

const fetchOriginal = globalThis.fetch;
const fetchSimule = jest.fn();
globalThis.fetch = fetchSimule;

const { geocode, geocodeOrNull, MAX_EN_ATTENTE_PAR_AGENT, MAX_EN_ATTENTE } = await import('../../src/services/geocoding.service.js');

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

  // #91 : avant, la file n'avait pas de fin : 300 adresses d'un agent bloquaient tout le monde 5 minutes
  test('file plafonnée : un agent ne peut pas avoir plus de 2 adresses en attente', async () => {
    let liberer;
    const bloque = new Promise((resolve) => { liberer = () => resolve(reponse([])); });
    fetchSimule.mockReturnValue(bloque);

    const enCours = [1, 2].map((n) => geocode(`Plafond agent ${n}`, 7));
    expect(MAX_EN_ATTENTE_PAR_AGENT).toBe(2);
    await expect(geocode('Plafond agent 3', 7)).rejects.toThrow('GEOCODER_BUSY');

    // Un autre agent n'est pas pénalisé
    const autre = geocode('Plafond autre agent', 8);

    liberer();
    await Promise.all([...enCours, autre]);
    // Les demandes terminées libèrent la place
    fetchSimule.mockResolvedValue(reponse([]));
    await expect(geocode('Plafond agent 4', 7)).resolves.toBeNull();
  }, 15000);

  test('file plafonnée pour tout le monde : au plus 10 adresses en attente', async () => {
    let liberer;
    const bloque = new Promise((resolve) => { liberer = () => resolve(reponse([])); });
    fetchSimule.mockReturnValue(bloque);

    // Sans agent (dossiers enregistrés par le serveur) : seul le plafond global s'applique
    const enCours = Array.from({ length: MAX_EN_ATTENTE }, (_, n) => geocode(`Plafond global ${n}`));
    await expect(geocode('Plafond global de trop')).rejects.toThrow('GEOCODER_BUSY');
    expect(await geocodeOrNull('Plafond global de trop 2')).toBeNull();

    liberer();
    await Promise.all(enCours);
  }, 30000);
});
