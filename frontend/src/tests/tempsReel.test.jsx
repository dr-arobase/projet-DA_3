// Récit R1 (#120) : l'application signale une coupure du temps réel et se reconnecte seule;
// R6 (#206) : un agent avec plusieurs onglets compte pour un (FC5 : trou comblé)
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import TempsReelProvider, { DELAI_PREMIERE_CONNEXION } from '../composants/TempsReelProvider.jsx';
import { useTempsReel } from '../composants/TempsReelContext.js';
import { AuthContext } from '../composants/AuthContext.js';

// Faux client Socket.IO : on déclenche connect / disconnect comme le ferait le réseau
const { sockets } = vi.hoisted(() => ({ sockets: [] }));
vi.mock('socket.io-client', () => ({
  io: () => {
    const gestionnaires = {};
    const s = {
      recovered: false,
      on: (e, h) => { (gestionnaires[e] ??= []).push(h); },
      off: () => {},
      disconnect: vi.fn(),
      recevoir: (e, p) => (gestionnaires[e] ?? []).forEach((h) => h(p)),
    };
    sockets.push(s);
    return s;
  },
}));

function Etat() {
  const { enLigne, premiereConnexion, reconnexions, reconnexionRecuperee, agentsConnectes } = useTempsReel();
  return (
    <p data-testid="etat">
      {enLigne ? 'en ligne' : 'hors ligne'} | reconnexions {reconnexions} | {reconnexionRecuperee ? 'rattrapé' : 'à recharger'} | {agentsConnectes} agents{premiereConnexion ? ' | première connexion' : ''}
    </p>
  );
}

function afficher(estConnecte = true) {
  return render(
    <AuthContext.Provider value={{ estConnecte }}>
      <TempsReelProvider><Etat /></TempsReelProvider>
    </AuthContext.Provider>
  );
}

const etat = () => screen.getByTestId('etat').textContent;

beforeEach(() => { sockets.length = 0; });

describe('Temps réel : coupure et reconnexion (R1)', () => {
  test('première connexion : en ligne, aucune reconnexion comptée', () => {
    afficher();
    act(() => sockets[0].recevoir('connect'));
    expect(etat()).toContain('en ligne | reconnexions 0');
  });

  test('coupure : l\'état passe hors ligne; retour : une reconnexion, avec ce qui a été rattrapé', () => {
    afficher();
    const s = sockets[0];
    act(() => s.recevoir('connect'));
    act(() => s.recevoir('disconnect'));
    expect(etat()).toContain('hors ligne');

    s.recovered = true; // le serveur a rejoué les événements manqués (connectionStateRecovery)
    act(() => s.recevoir('connect'));
    expect(etat()).toContain('en ligne | reconnexions 1 | rattrapé');
  });

  test('reconnexion sans rattrapage possible : la page sait qu\'elle doit recharger ses données', () => {
    afficher();
    const s = sockets[0];
    act(() => s.recevoir('connect'));
    act(() => s.recevoir('disconnect'));
    s.recovered = false;
    act(() => s.recevoir('connect'));
    expect(etat()).toContain('reconnexions 1 | à recharger');
  });

  test('sans session, aucune connexion Socket.IO n\'est ouverte', () => {
    afficher(false);
    expect(sockets).toHaveLength(0);
  });

  test('à la déconnexion de l\'agent, le socket est fermé', () => {
    const { unmount } = afficher();
    unmount();
    expect(sockets[0].disconnect).toHaveBeenCalled();
  });
});

describe('Juste après la connexion de l\'agent', () => {
  test('pendant la première connexion, ce n\'est pas une coupure; une fois relié, c\'est fini', () => {
    afficher();
    expect(etat()).toContain('hors ligne');
    expect(etat()).toContain('première connexion');
    act(() => sockets[0].recevoir('connect'));
    expect(etat()).not.toContain('première connexion');
  });

  test('sans réussir à se relier, au bout du délai, c\'est annoncé comme une coupure', () => {
    vi.useFakeTimers();
    try {
      afficher();
      act(() => { vi.advanceTimersByTime(DELAI_PREMIERE_CONNEXION + 1); });
      expect(etat()).toContain('hors ligne');
      expect(etat()).not.toContain('première connexion');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Présence (R6)', () => {
  test('plusieurs entrées du même agent comptent pour un', () => {
    afficher();
    act(() => sockets[0].recevoir('presence:update', [{ id: 1 }, { id: 2 }, { id: 1 }]));
    expect(etat()).toContain('2 agents');
  });
});
