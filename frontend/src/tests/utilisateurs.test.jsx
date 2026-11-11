// Page Utilisateurs : la direction réinitialise la double authentification d'un agent
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthContext } from '../composants/AuthContext.js';
import Utilisateurs from '../pages/Utilisateurs.jsx';
import * as api from '../api.js';

vi.mock('../api.js', () => ({
  listerUtilisateurs: vi.fn(),
  reinitialiserDeuxFacteurs: vi.fn(),
}));

const AGENTS = [
  { id: 1, first_name: 'Massyle', last_name: 'Riahi', badge_number: 'PO-001', email: 'po@x', role: 'direction', grade: 'directeur_general', is_active: true, created_at: '2026-10-28', totp_active: true },
  { id: 3, first_name: 'Chrysler', last_name: 'Jean', badge_number: 'PL-003', email: 'pl3@x', role: 'policier', grade: 'sergent_autres_fonctions', is_active: true, created_at: '2026-10-28', totp_active: true },
  { id: 4, first_name: 'Michael', last_name: 'Fortin', badge_number: 'PL-004', email: 'pl4@x', role: 'policier', grade: 'sergent_autres_fonctions', is_active: true, created_at: '2026-10-28', totp_active: false },
];

function afficher(utilisateur) {
  render(
    <AuthContext.Provider value={{ utilisateur }}>
      <Utilisateurs />
    </AuthContext.Provider>
  );
}
const ligne = (matricule) => screen.getByText(matricule).closest('tr');
const BOUTON = 'Réinitialiser la double authentification';

beforeEach(() => {
  vi.clearAllMocks();
  api.listerUtilisateurs.mockResolvedValue(AGENTS);
});

describe('Réinitialiser la double authentification', () => {
  test('la direction voit le bouton seulement pour un autre agent qui l\'a activée', async () => {
    afficher({ id: 1, role: 'direction' });
    await screen.findByText('PL-003');
    expect(within(ligne('PL-003')).getByRole('button', { name: BOUTON })).toBeInTheDocument();
    expect(within(ligne('PL-004')).queryByRole('button', { name: BOUTON })).not.toBeInTheDocument();
    expect(within(ligne('PO-001')).queryByRole('button', { name: BOUTON })).not.toBeInTheDocument(); // son propre compte
  });

  test('un superviseur ne voit pas le bouton', async () => {
    afficher({ id: 2, role: 'superviseur' });
    await screen.findByText('PL-003');
    expect(screen.queryByRole('button', { name: BOUTON })).not.toBeInTheDocument();
  });

  test('après confirmation, l\'API est appelée et le bouton disparaît', async () => {
    const user = userEvent.setup();
    api.reinitialiserDeuxFacteurs.mockResolvedValue({ message: 'ok' });
    afficher({ id: 1, role: 'direction' });
    await screen.findByText('PL-003');

    await user.click(within(ligne('PL-003')).getByRole('button', { name: BOUTON }));
    const fenetre = screen.getByRole('dialog');
    expect(fenetre).toHaveTextContent('perdu son téléphone');
    await user.click(within(fenetre).getByRole('button', { name: 'Réinitialiser' }));

    expect(api.reinitialiserDeuxFacteurs).toHaveBeenCalledWith(3);
    expect(await screen.findByText(/Double authentification de .* réinitialisée/)).toBeInTheDocument();
    expect(within(ligne('PL-003')).queryByRole('button', { name: BOUTON })).not.toBeInTheDocument();
  });

  test('annuler ne réinitialise rien', async () => {
    const user = userEvent.setup();
    afficher({ id: 1, role: 'direction' });
    await screen.findByText('PL-003');
    await user.click(within(ligne('PL-003')).getByRole('button', { name: BOUTON }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annuler' }));
    expect(api.reinitialiserDeuxFacteurs).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
