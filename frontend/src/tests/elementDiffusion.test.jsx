// Modifier, retirer et remettre une alerte ou un communiqué (#220) : les boutons pour l'auteur
// ou la direction, la mention « modifié le … par … », et les appels à l'API
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ElementDiffusion from '../composants/ElementDiffusion.jsx';
import * as api from '../api.js';

vi.mock('../api.js', () => ({
  modifierAlerte: vi.fn(),
  retirerAlerte: vi.fn(),
  remettreAlerte: vi.fn(),
}));

const POLICIER = { id: 7, role: 'policier' };
const AUTRE_POLICIER = { id: 8, role: 'policier' };
const SUPERVISEUR = { id: 9, role: 'superviseur' };
const DIRECTION = { id: 10, role: 'direction' };

const DIFFUSION = {
  id: 3, message: 'Suspect armé', severity: 'urgent', criminal_id: null,
  issued_by_id: 7, issued_by: 'Jean Tremblay', created_at: '2026-11-14T12:00:00Z',
  edited_at: null, edited_by: null, archived_at: null, archived_by: null,
};

function afficher(utilisateur, diffusion = DIFFUSION) {
  const rappels = { onChange: vi.fn(), onRetiree: vi.fn(), onRemise: vi.fn() };
  render(
    <ul>
      <ElementDiffusion diffusion={diffusion} utilisateur={utilisateur} {...rappels} />
    </ul>
  );
  return rappels;
}

beforeEach(() => vi.clearAllMocks());

describe('Une diffusion dans la liste (#220)', () => {
  test('son auteur voit Modifier et Retirer', () => {
    afficher(POLICIER);
    expect(screen.getByRole('button', { name: 'Modifier' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retirer' })).toBeInTheDocument();
  });

  test.each([
    ['un autre policier', AUTRE_POLICIER],
    ['un superviseur qui n\'en est pas l\'auteur', SUPERVISEUR],
  ])('%s ne voit aucun bouton', (_cas, utilisateur) => {
    afficher(utilisateur);
    expect(screen.queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retirer' })).not.toBeInTheDocument();
  });

  test('la direction voit les boutons sur la diffusion d\'un autre agent', () => {
    afficher(DIRECTION);
    expect(screen.getByRole('button', { name: 'Modifier' })).toBeInTheDocument();
  });

  test('modifier : le texte part sans les espaces autour, et la liste reçoit la diffusion à jour', async () => {
    const user = userEvent.setup();
    const modifiee = { ...DIFFUSION, message: 'Suspect armé, direction est', edited_at: '2026-11-14T17:00:00Z', edited_by: 'Jean Tremblay' };
    api.modifierAlerte.mockResolvedValue({ alert: modifiee });
    const { onChange } = afficher(POLICIER);

    await user.click(screen.getByRole('button', { name: 'Modifier' }));
    const champ = screen.getByLabelText('Nouveau texte');
    expect(champ).toHaveValue('Suspect armé');
    await user.clear(champ);
    await user.type(champ, '  Suspect armé, direction est  ');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(api.modifierAlerte).toHaveBeenCalledWith(3, 'Suspect armé, direction est');
    expect(onChange).toHaveBeenCalledWith(modifiee);
    expect(screen.queryByLabelText('Nouveau texte')).not.toBeInTheDocument();
  });

  test('un texte vide n\'appelle pas l\'API', async () => {
    const user = userEvent.setup();
    afficher(POLICIER);

    await user.click(screen.getByRole('button', { name: 'Modifier' }));
    await user.clear(screen.getByLabelText('Nouveau texte'));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(api.modifierAlerte).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Le message est obligatoire.');
  });

  test('« modifié le … par … » est affiché sous le texte', () => {
    afficher(AUTRE_POLICIER, { ...DIFFUSION, edited_at: '2026-11-14T17:00:00Z', edited_by: 'Marie Roy' });
    expect(screen.getByText(/^Modifié le .+ par Marie Roy$/)).toBeInTheDocument();
  });

  test('retirer : l\'API archive la diffusion et elle quitte la liste', async () => {
    const user = userEvent.setup();
    const retiree = { ...DIFFUSION, archived_at: '2026-11-14T18:00:00Z' };
    api.retirerAlerte.mockResolvedValue({ alert: retiree });
    const { onRetiree } = afficher(POLICIER);

    await user.click(screen.getByRole('button', { name: 'Retirer' }));

    expect(api.retirerAlerte).toHaveBeenCalledWith(3);
    expect(onRetiree).toHaveBeenCalledWith(retiree);
  });

  test('une diffusion retirée se remet, et seulement se remet', async () => {
    const user = userEvent.setup();
    const retiree = { ...DIFFUSION, archived_at: '2026-11-14T18:00:00Z', archived_by: 'Jean Tremblay' };
    api.remettreAlerte.mockResolvedValue({ alert: { ...retiree, archived_at: null, archived_by: null } });
    const { onRemise } = afficher(DIRECTION, retiree);

    expect(screen.queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument();
    expect(screen.getByText(/^Retiré le .+ par Jean Tremblay$/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remettre' }));

    expect(api.remettreAlerte).toHaveBeenCalledWith(3);
    expect(onRemise).toHaveBeenCalled();
  });

  test('un refus de l\'API est affiché et la diffusion reste', async () => {
    const user = userEvent.setup();
    api.retirerAlerte.mockRejectedValue(new Error('Cette diffusion est déjà retirée'));
    const { onRetiree } = afficher(POLICIER);

    await user.click(screen.getByRole('button', { name: 'Retirer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Cette diffusion est déjà retirée');
    expect(onRetiree).not.toHaveBeenCalled();
  });
});
