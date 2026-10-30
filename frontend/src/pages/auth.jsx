import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../composants/AuthContext.js';
import {
  IconeBouclier, IconeUtilisateur, IconeCadenas, IconeChevron, IconeGithub, IconeRecherche, IconeSirene, IconeMessage,
} from '../composants/Icones.jsx';
import { SANS_SERVEUR, urlApi } from '../config.js';
import '../styles/auth.css';

// Ce que l'application apporte à un agent, en une ligne chacun (direction E)
const ATOUTS = [
  { Icone: IconeRecherche, texte: 'Savoir en quelques secondes si une personne est recherchée' },
  { Icone: IconeSirene, texte: 'Recevoir les alertes urgentes sur toutes les pages' },
  { Icone: IconeMessage, texte: 'Signaler et échanger depuis le terrain' },
];

// Retour du serveur après la connexion GitHub : /connexion?erreur=…
const ERREURS_GITHUB = {
  github: 'La connexion avec GitHub a échoué. Réessayez.',
  'github-annule': 'Connexion avec GitHub annulée.',
  'github-non-configure': "La connexion GitHub n'est pas configurée sur ce serveur (voir le README).",
  inactif: 'Ce compte est désactivé.',
};

export default function Auth() {
  const { estConnecte, seConnecter, terminerConnexionGithub } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [parametres, setParametres] = useSearchParams();

  const [matricule, setMatricule] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [seSouvenir, setSeSouvenir] = useState(false);
  const [erreur, setErreur] = useState(() => ERREURS_GITHUB[parametres.get('erreur')] ?? '');
  const [enCours, setEnCours] = useState(false);

  // Retour de GitHub réussi : le cookie de session est posé, on charge le profil
  const retourGithub = parametres.get('github') === 'ok';
  useEffect(() => {
    if (!retourGithub) return;
    terminerConnexionGithub().catch(() => {
      setErreur(ERREURS_GITHUB.github);
      setParametres({}, { replace: true });
    });
  }, [retourGithub, terminerConnexionGithub, setParametres]);

  if (estConnecte) return <Navigate to="/" replace />;

  async function soumettre(e) {
    e.preventDefault();
    setErreur('');
    if (!matricule.trim() || !motDePasse) {
      setErreur('Le matricule et le mot de passe sont requis.');
      return;
    }
    setEnCours(true);
    try {
      await seConnecter(matricule.trim(), motDePasse, seSouvenir);
      navigate(location.state?.depuis ?? '/', { replace: true });
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="auth">
      <section className="auth-vitrine" aria-labelledby="auth-titre">
        <div className="auth-marque">
          <span className="logo-carre"><IconeBouclier /></span>
          <strong>CrimeTracker</strong>
        </div>

        <div className="auth-accroche">
          <h1 id="auth-titre">Le registre des personnes recherchées, à jour pour tous les agents en même temps.</h1>
          <ul className="auth-atouts">
            {ATOUTS.map(({ Icone, texte }) => (
              <li key={texte}><span className="auth-atout-icone"><Icone taille={18} /></span>{texte}</li>
            ))}
          </ul>
        </div>

        <p className="auth-pied">
          <IconeCadenas taille={14} /> Accès réservé au personnel autorisé. Chaque action est inscrite au journal d'audit.
        </p>
      </section>

      <section className="auth-panneau">
        <form className="auth-formulaire" onSubmit={soumettre} noValidate>
          <h2>Connexion</h2>
          <p className="auth-sous-titre">Identifiez-vous avec vos accès professionnels</p>

          {SANS_SERVEUR && (
            <p className="auth-erreur" role="status">
              Version de démonstration publiée sur GitHub Pages : le serveur n'est pas en ligne, la connexion
              ne fonctionne donc pas ici. Pour utiliser l'application, lancez-la avec Docker (voir le README).
            </p>
          )}

          <label htmlFor="matricule">Matricule</label>
          <div className="champ">
            <IconeUtilisateur taille={16} />
            <input
              id="matricule"
              type="text"
              placeholder="RP-48213"
              autoComplete="username"
              value={matricule}
              onChange={(e) => setMatricule(e.target.value)}
            />
          </div>

          <label htmlFor="mot-de-passe">Mot de passe</label>
          <div className="champ">
            <IconeCadenas taille={16} />
            <input
              id="mot-de-passe"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
            />
          </div>

          <div className="auth-options">
            <label className="case">
              <input
                type="checkbox"
                checked={seSouvenir}
                onChange={(e) => setSeSouvenir(e.target.checked)}
              />
              Se souvenir de moi
            </label>
          </div>

          {erreur && <p className="auth-erreur" role="alert">{erreur}</p>}

          <button type="submit" className="bouton-principal" disabled={enCours}>
            {enCours ? 'Connexion…' : 'Se connecter'}
            {!enCours && <IconeChevron taille={16} />}
          </button>

          <p className="auth-separateur"><span>ou</span></p>

          {/* Navigation complète, pas un fetch : le serveur redirige vers GitHub puis revient ici */}
          <a className="bouton-github" href={urlApi('/api/auth/github')}>
            <IconeGithub />
            Se connecter avec GitHub
          </a>

          <p className="auth-mention">Mot de passe oublié ? Adressez-vous à votre superviseur.</p>
        </form>
      </section>
    </div>
  );
}
