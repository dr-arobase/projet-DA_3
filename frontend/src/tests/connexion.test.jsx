// Page de connexion : la deuxième étape (code de double authentification)
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../composants/AuthContext.js';
import Auth from '../pages/auth.jsx';

function afficher({ seConnecter = vi.fn(), verifierCode = vi.fn(), adresse = '/connexion' } = {}) {
  const auth = {
    estConnecte: false,
    seConnecter,
    verifierCode,
    terminerConnexionGithub: vi.fn(() => Promise.resolve()),
  };
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[adresse]}>
        <Routes>
          <Route path="/connexion" element={<Auth />} />
          <Route path="/" element={<p>Tableau de bord</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
  return auth;
}

async function entrerMotDePasse(user) {
  await user.type(screen.getByLabelText('Matricule'), 'SM-002');
  await user.type(screen.getByLabelText('Mot de passe'), 'Alpha2026!');
  await user.click(screen.getByRole('button', { name: /Se connecter$/ }));
}

describe('Connexion avec double authentification', () => {
  test('sans double authentification, le mot de passe mène au tableau de bord', async () => {
    const user = userEvent.setup();
    afficher({ seConnecter: vi.fn().mockResolvedValue({ id: 2 }) });
    await entrerMotDePasse(user);
    expect(await screen.findByText('Tableau de bord')).toBeInTheDocument();
  });

  test('avec double authentification, le code est demandé, puis la session s\'ouvre', async () => {
    const user = userEvent.setup();
    const auth = afficher({
      seConnecter: vi.fn().mockResolvedValue({ deuxFacteurs: true }),
      verifierCode: vi.fn().mockResolvedValue({ id: 2 }),
    });
    await entrerMotDePasse(user);

    expect(await screen.findByRole('heading', { name: 'Double authentification' })).toBeInTheDocument();
    expect(screen.queryByText('Tableau de bord')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Code de vérification'), '123456');
    await user.click(screen.getByRole('button', { name: /Vérifier/ }));

    expect(auth.verifierCode).toHaveBeenCalledWith('123456', false);
    expect(await screen.findByText('Tableau de bord')).toBeInTheDocument();
  });

  test('un mauvais code affiche l\'erreur et vide le champ', async () => {
    const user = userEvent.setup();
    afficher({
      seConnecter: vi.fn().mockResolvedValue({ deuxFacteurs: true }),
      verifierCode: vi.fn().mockRejectedValue(Object.assign(new Error('Code incorrect ou déjà utilisé.'), { status: 401 })),
    });
    await entrerMotDePasse(user);
    await user.type(await screen.findByLabelText('Code de vérification'), '000000');
    await user.click(screen.getByRole('button', { name: /Vérifier/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Code incorrect ou déjà utilisé.');
    expect(screen.getByLabelText('Code de vérification')).toHaveValue('');
    expect(screen.getByRole('heading', { name: 'Double authentification' })).toBeInTheDocument();
  });

  test('une étape expirée ramène au mot de passe', async () => {
    const user = userEvent.setup();
    afficher({
      seConnecter: vi.fn().mockResolvedValue({ deuxFacteurs: true }),
      verifierCode: vi.fn().mockRejectedValue(Object.assign(new Error('Étape de connexion expirée. Reconnectez-vous.'), { status: 401 })),
    });
    await entrerMotDePasse(user);
    await user.type(await screen.findByLabelText('Code de vérification'), '123456');
    await user.click(screen.getByRole('button', { name: /Vérifier/ }));

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('expirée');
  });

  test('au retour de GitHub (?etape=code), la page demande directement le code', () => {
    afficher({ adresse: '/connexion?etape=code' });
    expect(screen.getByRole('heading', { name: 'Double authentification' })).toBeInTheDocument();
    expect(screen.getByText(/codes de secours/)).toBeInTheDocument();
  });

  test('« Revenir à la connexion » ramène au formulaire du mot de passe', async () => {
    const user = userEvent.setup();
    afficher({ adresse: '/connexion?etape=code' });
    await user.click(screen.getByRole('button', { name: 'Revenir à la connexion' }));
    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
  });
});
