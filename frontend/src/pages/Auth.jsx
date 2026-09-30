import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../composants/AuthContext.js';
import { IconeBouclier, IconeUtilisateur, IconeCadenas, IconeChevron } from '../composants/Icones.jsx';
import '../styles/auth.css';

const STATS = [
  { valeur: 128, libelle: 'Fiches actives' },
  { valeur: 58, libelle: 'Agents connectés' },
  { valeur: 6, libelle: "Alertes aujourd'hui" },
];

export default function Auth() {
  const { estConnecte, seConnecter } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [matricule, setMatricule] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [seSouvenir, setSeSouvenir] = useState(false);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

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
      <section className="auth-vitrine">
        <div className="auth-marque">
          <span className="logo-carre"><IconeBouclier /></span>
          <span>SentinelleRP</span>
        </div>

        <div className="auth-accroche">
          <h1>Le réseau sécurisé des forces de l'ordre</h1>
          <p>
            Échangez sur les personnes recherchées, suivez les alertes en temps réel et
            communiquez avec vos équipes, depuis un seul espace de travail.
          </p>
          <ul className="auth-stats">
            {STATS.map((s) => (
              <li key={s.libelle}>
                <strong>{s.valeur}</strong>
                <span>{s.libelle}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="auth-pied">Police Municipale de Hauteville</p>
      </section>

      <section className="auth-panneau">
        <form className="auth-formulaire" onSubmit={soumettre} noValidate>
          <h2>Connexion</h2>
          <p className="auth-sous-titre">Identifiez-vous avec vos accès professionnels</p>

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
            <a href="#" onClick={(e) => e.preventDefault()}>Mot de passe oublié ?</a>
          </div>

          {erreur && <p className="auth-erreur" role="alert">{erreur}</p>}

          <button type="submit" className="bouton-principal" disabled={enCours}>
            {enCours ? 'Connexion…' : 'Connexion sécurisée'}
            {!enCours && <IconeChevron taille={16} />}
          </button>

          <p className="auth-info">
            <IconeCadenas taille={14} /> Authentification à deux facteurs requise
          </p>

          <p className="auth-mention">Accès réservé au personnel autorisé — usage tracé et audité.</p>
        </form>
      </section>
    </div>
  );
}
