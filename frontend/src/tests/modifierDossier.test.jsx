// Modification complète d'un dossier (FC2, #98, #187) : la version lue part avec la demande;
// en cas de conflit (409), l'agent voit l'état actuel et garde son brouillon
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModifierDossier from '../composants/ModifierDossier.jsx';
import * as api from '../api.js';

vi.mock('../api.js', () => ({
  modifierCriminel: vi.fn(),
}));

const DOSSIER = {
  id: 1, first_name: 'Jean', last_name: 'Dupont', date_of_birth: '1985-04-12T00:00:00.000Z',
  nationality: 'Canadienne', crimes: 'Vol', description: 'Cicatrice', version: 3,
};

function conflit(actuel) {
  return Object.assign(new Error('Conflit de version'), { status: 409, donnees: { criminal: actuel } });
}

function afficher(dossier = DOSSIER) {
  const onMisAJour = vi.fn();
  const rendu = render(<ModifierDossier dossier={dossier} onMisAJour={onMisAJour} />);
  return { onMisAJour, ...rendu };
}

beforeEach(() => vi.clearAllMocks());

describe('Modifier le dossier', () => {
  test('le formulaire reprend les valeurs du dossier, et la version part avec la demande', async () => {
    const user = userEvent.setup();
    const misAJour = { ...DOSSIER, crimes: 'Vol à main armée', version: 4 };
    api.modifierCriminel.mockResolvedValue({ criminal: misAJour });
    const { onMisAJour } = afficher();

    await user.click(screen.getByRole('button', { name: 'Modifier le dossier' }));
    expect(screen.getByLabelText('Prénom')).toHaveValue('Jean');
    expect(screen.getByLabelText('Date de naissance')).toHaveValue('1985-04-12');

    await user.clear(screen.getByLabelText('Crimes reprochés'));
    await user.type(screen.getByLabelText('Crimes reprochés'), 'Vol à main armée');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(api.modifierCriminel).toHaveBeenCalledWith(1, expect.objectContaining({ crimes: 'Vol à main armée', description: 'Cicatrice' }), 3);
    expect(onMisAJour).toHaveBeenCalledWith(misAJour);
    expect(await screen.findByText('Dossier mis à jour.')).toBeInTheDocument();
  });

  test('409 : la fiche reçoit l\'état actuel, un message l\'explique et le brouillon reste', async () => {
    const user = userEvent.setup();
    const actuel = { ...DOSSIER, description: 'Tatouage au bras', version: 4, updated_by: 'Marie Roy' };
    api.modifierCriminel.mockRejectedValue(conflit(actuel));
    const { onMisAJour } = afficher();

    await user.click(screen.getByRole('button', { name: 'Modifier le dossier' }));
    await user.clear(screen.getByLabelText('Crimes reprochés'));
    await user.type(screen.getByLabelText('Crimes reprochés'), 'Fraude');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(onMisAJour).toHaveBeenCalledWith(actuel);
    expect(await screen.findByRole('alert')).toHaveTextContent(/modifié entre-temps par Marie Roy/);
    expect(screen.getByRole('alert')).toHaveTextContent(/n'ont pas été appliqués/);
    expect(screen.getByLabelText('Crimes reprochés')).toHaveValue('Fraude');
  });

  test('après un 409, réessayer envoie la version actuelle que l\'agent vient de voir', async () => {
    const user = userEvent.setup();
    const actuel = { ...DOSSIER, version: 4 };
    api.modifierCriminel.mockRejectedValueOnce(conflit(actuel)).mockResolvedValueOnce({ criminal: { ...actuel, version: 5 } });
    afficher();

    await user.click(screen.getByRole('button', { name: 'Modifier le dossier' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(api.modifierCriminel).toHaveBeenLastCalledWith(1, expect.any(Object), 4);
  });

  test('la version envoyée est celle lue à l\'ouverture, même si la fiche se met à jour en direct', async () => {
    const user = userEvent.setup();
    api.modifierCriminel.mockRejectedValue(conflit({ ...DOSSIER, version: 4 }));
    const { onMisAJour, rerender } = afficher();

    await user.click(screen.getByRole('button', { name: 'Modifier le dossier' }));
    // Un autre agent enregistre pendant que le formulaire est ouvert : la fiche reçoit la version 4
    rerender(<ModifierDossier dossier={{ ...DOSSIER, version: 4 }} onMisAJour={onMisAJour} />);
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(api.modifierCriminel).toHaveBeenCalledWith(1, expect.any(Object), 3);
  });

  test('le prénom et le nom sont obligatoires, sans appel à l\'API', async () => {
    const user = userEvent.setup();
    afficher();

    await user.click(screen.getByRole('button', { name: 'Modifier le dossier' }));
    await user.clear(screen.getByLabelText('Nom'));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Le prénom et le nom sont obligatoires.');
    expect(api.modifierCriminel).not.toHaveBeenCalled();
  });
});
