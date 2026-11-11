// Double authentification dans « Mon profil » : activer, codes de secours, désactiver
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeuxFacteurs from '../composants/DeuxFacteurs.jsx';
import * as api from '../api.js';

vi.mock('../api.js', () => ({
  preparerDeuxFacteurs: vi.fn(),
  activerDeuxFacteurs: vi.fn(),
  desactiverDeuxFacteurs: vi.fn(),
}));

const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const CODES = ['AAAA-BBBB', 'CCCC-DDDD', 'EEEE-FFFF', 'GGGG-HHHH', 'JJJJ-KKKK',
  'MMMM-NNNN', 'PPPP-QQQQ', 'RRRR-SSSS', 'TTTT-UUUU', 'VVVV-WWWW'];
const agent = (changements = {}) => ({ id: 2, badge_number: 'SM-002', totp_active: false, ...changements });

beforeEach(() => vi.clearAllMocks());

describe('DeuxFacteurs', () => {
  test('inactive : explique la double authentification et propose de l\'activer', () => {
    render(<DeuxFacteurs utilisateur={agent()} mettreAJourUtilisateur={vi.fn()} />);
    expect(screen.getByText('Inactive.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Activer la double authentification/ })).toBeEnabled();
  });

  test('activer : code QR et clé manuelle, premier code, puis les 10 codes de secours', async () => {
    const user = userEvent.setup();
    const mettreAJour = vi.fn();
    api.preparerDeuxFacteurs.mockResolvedValue({ secret: SECRET, adresse: `otpauth://totp/CrimeTracker:SM-002?secret=${SECRET}` });
    api.activerDeuxFacteurs.mockResolvedValue({ codesSecours: CODES, user: agent({ totp_active: true }) });
    render(<DeuxFacteurs utilisateur={agent()} mettreAJourUtilisateur={mettreAJour} />);

    await user.click(screen.getByRole('button', { name: /Activer la double authentification/ }));
    expect(screen.getByTitle('Code QR de la double authentification')).toBeInTheDocument();
    expect(screen.getByText('JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP')).toBeInTheDocument();

    const bouton = screen.getByRole('button', { name: 'Activer' });
    expect(bouton).toBeDisabled(); // tant qu'il n'y a pas 6 chiffres
    await user.type(screen.getByLabelText(/Code à 6 chiffres/), '12a34 56');
    expect(screen.getByLabelText(/Code à 6 chiffres/)).toHaveValue('123456'); // seuls les chiffres restent
    await user.click(bouton);

    expect(api.activerDeuxFacteurs).toHaveBeenCalledWith('123456');
    expect(mettreAJour).toHaveBeenCalledWith(agent({ totp_active: true }));
    expect(await screen.findByText('Double authentification activée.')).toBeInTheDocument();
    CODES.forEach((c) => expect(screen.getByText(c)).toBeInTheDocument());
    expect(screen.getByText(/Ils ne seront plus jamais affichés/)).toBeInTheDocument();
  });

  test('un mauvais code affiche le message du serveur et laisse réessayer', async () => {
    const user = userEvent.setup();
    api.preparerDeuxFacteurs.mockResolvedValue({ secret: SECRET, adresse: 'otpauth://totp/x' });
    api.activerDeuxFacteurs.mockRejectedValue(new Error('Code incorrect. Vérifiez que le code QR a bien été scanné, puis réessayez.'));
    render(<DeuxFacteurs utilisateur={agent()} mettreAJourUtilisateur={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Activer la double authentification/ }));
    await user.type(screen.getByLabelText(/Code à 6 chiffres/), '000000');
    await user.click(screen.getByRole('button', { name: 'Activer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Code incorrect');
    expect(screen.getByRole('button', { name: 'Activer' })).toBeEnabled();
  });

  test('annuler revient à l\'état inactif sans rien activer', async () => {
    const user = userEvent.setup();
    api.preparerDeuxFacteurs.mockResolvedValue({ secret: SECRET, adresse: 'otpauth://totp/x' });
    render(<DeuxFacteurs utilisateur={agent()} mettreAJourUtilisateur={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Activer la double authentification/ }));
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByText('Inactive.')).toBeInTheDocument();
    expect(api.activerDeuxFacteurs).not.toHaveBeenCalled();
  });

  test('active, compte avec mot de passe : désactiver demande le mot de passe et un code', async () => {
    const user = userEvent.setup();
    const mettreAJour = vi.fn();
    api.desactiverDeuxFacteurs.mockResolvedValue({ user: agent() });
    render(<DeuxFacteurs utilisateur={agent({ totp_active: true })} mettreAJourUtilisateur={mettreAJour} />);

    expect(screen.getByText(/Active : à chaque connexion/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Mot de passe actuel'), 'Alpha2026!');
    await user.type(screen.getByLabelText('Code de vérification'), '654321');
    await user.click(screen.getByRole('button', { name: 'Désactiver la double authentification' }));

    expect(api.desactiverDeuxFacteurs).toHaveBeenCalledWith('Alpha2026!', '654321');
    expect(mettreAJour).toHaveBeenCalledWith(agent());
    expect(await screen.findByText('Double authentification désactivée.')).toBeInTheDocument();
  });

  test('active, compte GitHub : pas de mot de passe, le code suffit', async () => {
    const user = userEvent.setup();
    api.desactiverDeuxFacteurs.mockResolvedValue({ user: agent({ badge_number: 'GH-1' }) });
    render(<DeuxFacteurs utilisateur={agent({ badge_number: 'GH-1', totp_active: true })} mettreAJourUtilisateur={vi.fn()} />);

    expect(screen.queryByLabelText('Mot de passe actuel')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Code de vérification'), 'AAAA-BBBB');
    await user.click(screen.getByRole('button', { name: 'Désactiver la double authentification' }));
    expect(api.desactiverDeuxFacteurs).toHaveBeenCalledWith(undefined, 'AAAA-BBBB');
  });
});
