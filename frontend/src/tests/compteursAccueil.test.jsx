// Audit du 25 novembre : sur un serveur lent, l'accueil affichait « 0 fiche active » le temps du chargement.
// Les compteurs montrent « … » tant que les données ne sont pas arrivées, puis les vrais nombres.
import { describe, test, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useDashboardData from '../hooks/useDashboardData.js';
import { TempsReelContext } from '../composants/TempsReelContext.js';
import * as api from '../api.js';

vi.mock('../api.js', () => ({
  listerCriminels: vi.fn(),
  listerAlertes: vi.fn(),
}));

const avecTempsReel = ({ children }) => (
  <TempsReelContext.Provider value={{ socket: null, agentsConnectes: 2, reconnexions: 0, reconnexionRecuperee: false }}>
    {children}
  </TempsReelContext.Provider>
);

describe('Compteurs de l\'accueil', () => {
  test('pendant le chargement : aucun faux « 0 », puis les vrais nombres', async () => {
    let repondre;
    const enAttente = new Promise((r) => { repondre = r; });
    api.listerCriminels.mockImplementation(async ({ status } = {}) => {
      await enAttente;
      return { total: status === 'recherche' ? 7 : 3, data: [] };
    });
    api.listerAlertes.mockImplementation(async () => {
      await enAttente;
      return { total: 1, data: [] };
    });

    const { result } = renderHook(() => useDashboardData(), { wrapper: avecTempsReel });

    // Rien n'est arrivé : aucun compteur ne prétend valoir 0
    expect(result.current.stats.map((s) => s.valeur)).toEqual([null, null, null, null]);

    repondre();
    await waitFor(() => expect(result.current.stats[0].valeur).toBe(7));
    expect(result.current.stats.map((s) => s.valeur)).toEqual([7, 1, 3, 2]);
  });

  test('si l\'API ne répond pas : un message d\'erreur, et toujours pas de faux « 0 »', async () => {
    api.listerCriminels.mockRejectedValue(new Error('Serveur injoignable'));
    api.listerAlertes.mockRejectedValue(new Error('Serveur injoignable'));

    const { result } = renderHook(() => useDashboardData(), { wrapper: avecTempsReel });

    await waitFor(() => expect(result.current.erreur).toBe('Serveur injoignable'));
    expect(result.current.stats.every((s) => s.valeur === null)).toBe(true);
  });
});
