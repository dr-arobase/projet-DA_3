// Récit 18 (#20) : statistiques globales du registre, tenues à jour en temps réel (FC5 : trou comblé)
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import Statistiques from '../pages/Statistiques.jsx';
import { TempsReelContext } from '../composants/TempsReelContext.js';
import * as api from '../api.js';

vi.mock('../api.js', () => ({
  listerCriminels: vi.fn(),
  listerAlertes: vi.fn(),
}));

// Socket simulé : garde les gestionnaires pour déclencher un événement comme le serveur
function fauxSocket() {
  const gestionnaires = {};
  return {
    gestionnaires,
    on: (e, h) => { (gestionnaires[e] ??= new Set()).add(h); },
    off: (e, h) => gestionnaires[e]?.delete(h),
    recevoir: (e, p) => gestionnaires[e]?.forEach((h) => h(p)),
  };
}

// Totaux par statut que renvoie l'API (limit=1 : seul le total compte)
function totaux({ recherche, capture, libere, urgentes = 0 }) {
  api.listerCriminels.mockImplementation(async ({ status } = {}) => {
    const parStatut = { recherche, capture, libere };
    return status ? { total: parStatut[status], data: [] } : { total: recherche + capture + libere, data: [] };
  });
  api.listerAlertes.mockImplementation(async ({ severity } = {}) => (
    severity ? { total: urgentes, data: [] } : { data: [] }
  ));
}

function afficher(socket, agentsConnectes = 3) {
  render(
    <TempsReelContext.Provider value={{ socket, agentsConnectes }}>
      <Statistiques />
    </TempsReelContext.Provider>
  );
}

const tuile = (libelle) => screen.getByText(libelle).previousSibling;

beforeEach(() => vi.clearAllMocks());

describe('Statistiques (#20)', () => {
  test('tuiles : total du registre, taux de capture, alertes urgentes du jour et agents connectés', async () => {
    totaux({ recherche: 6, capture: 3, libere: 1, urgentes: 2 });
    afficher(fauxSocket(), 4);

    expect(await screen.findByText('10')).toBeInTheDocument();
    expect(tuile('Dossiers au registre')).toHaveTextContent('10');
    expect(tuile('Taux de capture')).toHaveTextContent('30 %');
    expect(tuile("Alertes urgentes aujourd'hui")).toHaveTextContent('2');
    expect(tuile('Agents connectés')).toHaveTextContent('4');
    expect(screen.getByText('3 (30 %)')).toBeInTheDocument();
  });

  test('les alertes urgentes sont comptées depuis minuit, côté serveur', async () => {
    totaux({ recherche: 1, capture: 0, libere: 0, urgentes: 0 });
    afficher(fauxSocket());
    await screen.findByText('Dossiers au registre');

    const appel = api.listerAlertes.mock.calls.find(([p]) => p.severity === 'urgent')[0];
    const depuis = new Date(appel.since);
    expect([depuis.getHours(), depuis.getMinutes(), depuis.getSeconds()]).toEqual([0, 0, 0]);
    expect(appel.limit).toBe(1);
  });

  test('un dossier capturé ailleurs met les statistiques à jour sans recharger la page', async () => {
    const socket = fauxSocket();
    totaux({ recherche: 4, capture: 0, libere: 0 });
    afficher(socket);
    expect(await screen.findByText('0 %')).toBeInTheDocument();

    totaux({ recherche: 3, capture: 1, libere: 0 });
    await act(async () => socket.recevoir('criminal:updated', { id: 1, status: 'capture' }));

    expect(await screen.findByText('25 %')).toBeInTheDocument();
  });

  test('une panne de l\'API est affichée', async () => {
    api.listerCriminels.mockRejectedValue(new Error('Erreur serveur'));
    api.listerAlertes.mockResolvedValue({ total: 0, data: [] });
    afficher(fauxSocket());

    expect(await screen.findByRole('alert')).toHaveTextContent('Erreur serveur');
  });
});
