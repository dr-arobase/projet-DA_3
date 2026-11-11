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
  const { estConnecte, seConnecter, verifierCode, terminerConnexionGithub } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [parametres, setParametres] = useSearchParams();

  const [matricule, setMatricule] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [seSouvenir, setSeSouvenir] = useState(false);
  const [erreur, setErreur] = useState(() => ERREURS_GITHUB[parametres.get('erreur')] ?? '');
  const [enCours, setEnCours] = useState(false);
  // Deuxième étape (double authentification) : après le mot de passe, ou au retour de GitHub (?etape=code)
  const [etapeCode, setEtapeCode] = useState(() => parametres.get('etape') === 'code');
  const [code, setCode] = useState('');

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
      const resultat = await seConnecter(matricule.trim(), motDePasse, seSouvenir);
      if (resultat?.deuxFacteurs) {
        setMotDePasse('');
        setEtapeCode(true);
        return;
      }
      navigate(location.state?.depuis ?? '/', { replace: true });
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  }

  async function soumettreCode(e) {
    e.preventDefault();
    setErreur('');
    if (!code.trim()) {
      setErreur('Entrez le code à 6 chiffres de votre application.');
      return;
    }
    setEnCours(true);
    try {
      await verifierCode(code.trim(), seSouvenir);
      navigate(location.state?.depuis ?? '/', { replace: true });
    } catch (err) {
      setErreur(err.message);
      setCode('');
      // Étape expirée (plus de 5 minutes) : on recommence avec le mot de passe
      if (err.status === 401 && /expirée/.test(err.message)) setEtapeCode(false);
    } finally {
      setEnCours(false);
    }
  }

  function revenirAuMotDePasse() {
    setEtapeCode(false);
    setCode('');
    setErreur('');
    setParametres({}, { replace: true });
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
      </section>

      <section className="auth-panneau">
        {etapeCode ? (
          <form className="auth-formulaire" onSubmit={soumettreCode} noValidate>
            <h2>Double authentification</h2>
            <p className="auth-sous-titre">
              Ouvrez Google Authenticator (ou votre application d'authentification) et entrez le code à 6 chiffres de CrimeTracker.
            </p>

            <label htmlFor="code-double">Code de vérification</label>
            <div className="champ">
              <IconeCadenas taille={16} />
              <input
                id="code-double"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={20}
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <p className="auth-indice">Téléphone perdu ? Entrez un de vos codes de secours (ABCD-EFGH).</p>

            {erreur && <p className="auth-erreur" role="alert">{erreur}</p>}

            <button type="submit" className="bouton-principal" disabled={enCours}>
              {enCours ? 'Vérification…' : 'Vérifier'}
              {!enCours && <IconeChevron taille={16} />}
            </button>
            <button type="button" className="bouton-lien" onClick={revenirAuMotDePasse}>
              Revenir à la connexion
            </button>
          </form>
        ) : (
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
        )}
      </section>
    </div>
  );
}
