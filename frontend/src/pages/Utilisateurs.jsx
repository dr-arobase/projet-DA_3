import { useEffect, useState } from 'react';
import * as api from '../api.js';
import { useAuth } from '../composants/AuthContext.js';
import { IconeAjoutPersonne } from '../composants/Icones.jsx';
import {
  ROLES, LIBELLES_ROLE, LIBELLES_GRADE, GRADES_PAR_ROLE, estAuMoins, nomAgent,
} from '../agents.js';
import { formaterDate } from '../registre.js';
import '../styles/registre.css';
import '../styles/pages.css';

const VIDE = { first_name: '', last_name: '', badge_number: '', email: '', password: '', role: 'policier', grade: 'sergent_autres_fonctions' };
const MIN_MOT_DE_PASSE = 8;

// Gestion des comptes : créer (#10), désactiver / réactiver (#16), promouvoir (#19, direction seulement)
export default function Utilisateurs() {
  const { utilisateur } = useAuth();
  const autorise = estAuMoins(utilisateur, 'superviseur');
  const peutPromouvoir = estAuMoins(utilisateur, 'direction');

  const [agents, setAgents] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [message, setMessage] = useState({ type: '', texte: '' });
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [promotion, setPromotion] = useState(null); // { id, role, grade }

  useEffect(() => {
    if (!autorise) return;
    api.listerUtilisateurs()
      .then(setAgents)
      .catch((err) => setMessage({ type: 'erreur', texte: err.message }))
      .finally(() => setChargement(false));
  }, [autorise]);

  if (!autorise) {
    return (
      <div className="page page-vide">
        <h1>Accès réservé</h1>
        <p>La gestion des comptes est réservée aux superviseurs et à la direction.</p>
      </div>
    );
  }

  const remplacer = (agent) => setAgents((enCours) => enCours.map((a) => (a.id === agent.id ? agent : a)));

  async function basculerActif(agent) {
    try {
      const { user } = agent.is_active
        ? await api.desactiverUtilisateur(agent.id)
        : await api.reactiverUtilisateur(agent.id);
      remplacer(user);
      setMessage({ type: 'succes', texte: `Compte de ${nomAgent(user)} ${user.is_active ? 'réactivé' : 'désactivé'}.` });
    } catch (err) {
      setMessage({ type: 'erreur', texte: err.message });
    }
  }

  async function promouvoir(e) {
    e.preventDefault();
    try {
      const { user } = await api.promouvoirUtilisateur(promotion.id, promotion.role, promotion.grade);
      remplacer(user);
      setPromotion(null);
      setMessage({ type: 'succes', texte: `${nomAgent(user)} est maintenant ${LIBELLES_GRADE[user.grade].toLowerCase()}.` });
    } catch (err) {
      setMessage({ type: 'erreur', texte: err.message });
    }
  }

  function ajoute(agent) {
    setAgents((enCours) => [...enCours, agent].sort((a, b) => a.last_name.localeCompare(b.last_name, 'fr')));
    setFormulaireOuvert(false);
    setMessage({ type: 'succes', texte: `Compte de ${nomAgent(agent)} créé (matricule ${agent.badge_number}).` });
  }

  return (
    <>
      <header className="entete-registre">
        <div>
          <h1>Utilisateurs</h1>
          <p>{agents.length} compte{agents.length > 1 ? 's' : ''} d'agent</p>
        </div>
        {!formulaireOuvert && (
          <button type="button" className="registre-bouton-principal" onClick={() => setFormulaireOuvert(true)}>
            <IconeAjoutPersonne taille={17} /> Nouveau compte
          </button>
        )}
      </header>

      <div className="page pages-colonne">
        {formulaireOuvert && <NouveauCompte onCree={ajoute} onAnnuler={() => setFormulaireOuvert(false)} />}

        {message.texte && (
          <p className={`registre-message ${message.type}`} role={message.type === 'erreur' ? 'alert' : 'status'}>{message.texte}</p>
        )}

        <div className="carte registre-tableau-cadre">
          <table className="registre-tableau pages-tableau-fixe">
            <thead>
              <tr>
                <th scope="col">Agent</th>
                <th scope="col">Rôle et grade</th>
                <th scope="col">État</th>
                <th scope="col">Créé</th>
                <th scope="col"><span className="visuellement-cache">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id}>
                  <td>
                    {nomAgent(a)}
                    <small>{a.badge_number} · {a.email}</small>
                  </td>
                  <td>
                    {promotion?.id === a.id ? (
                      <form className="pages-promotion" onSubmit={promouvoir}>
                        <select
                          className="registre-select"
                          aria-label="Rôle"
                          value={promotion.role}
                          onChange={(e) => setPromotion({ ...promotion, role: e.target.value, grade: GRADES_PAR_ROLE[e.target.value][0] })}
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{LIBELLES_ROLE[r]}</option>)}
                        </select>
                        <select
                          className="registre-select"
                          aria-label="Grade"
                          value={promotion.grade}
                          onChange={(e) => setPromotion({ ...promotion, grade: e.target.value })}
                        >
                          {GRADES_PAR_ROLE[promotion.role].map((g) => <option key={g} value={g}>{LIBELLES_GRADE[g]}</option>)}
                        </select>
                        <button type="submit" className="registre-bouton-principal">Enregistrer</button>
                        <button type="button" className="registre-lien" onClick={() => setPromotion(null)}>Annuler</button>
                      </form>
                    ) : (
                      <>
                        {LIBELLES_ROLE[a.role]}
                        <small>{LIBELLES_GRADE[a.grade]}</small>
                      </>
                    )}
                  </td>
                  <td>
                    <span className={`statut ${a.is_active ? 'statut-capture' : 'statut-recherche'}`}>
                      {a.is_active ? 'Actif' : 'Désactivé'}
                    </span>
                  </td>
                  <td>{formaterDate(a.created_at)}</td>
                  <td className="pages-actions">
                    {peutPromouvoir && promotion?.id !== a.id && a.id !== utilisateur.id && (
                      <button type="button" className="registre-lien" onClick={() => setPromotion({ id: a.id, role: a.role, grade: a.grade })}>
                        Promouvoir
                      </button>
                    )}
                    {/* On ne se désactive pas soi-même : on perdrait l'accès */}
                    {a.id !== utilisateur.id && (
                      <button type="button" className="registre-lien" onClick={() => basculerActif(a)}>
                        {a.is_active ? 'Désactiver' : 'Réactiver'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {chargement && <tr className="registre-vide"><td colSpan={5}>Chargement…</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function NouveauCompte({ onCree, onAnnuler }) {
  const [champs, setChamps] = useState(VIDE);
  const [erreurs, setErreurs] = useState({});
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const modifier = (nom) => (e) => {
    const valeur = e.target.value;
    // Changer de rôle propose le premier grade de ce rôle
    setChamps((c) => (nom === 'role' ? { ...c, role: valeur, grade: GRADES_PAR_ROLE[valeur][0] } : { ...c, [nom]: valeur }));
  };

  function valider() {
    const trouvees = {};
    for (const nom of ['first_name', 'last_name', 'badge_number', 'email']) {
      if (!champs[nom].trim()) trouvees[nom] = 'Champ obligatoire.';
    }
    if (champs.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(champs.email.trim())) {
      trouvees.email = 'Adresse courriel invalide.';
    }
    if (champs.password.length < MIN_MOT_DE_PASSE) {
      trouvees.password = `Au moins ${MIN_MOT_DE_PASSE} caractères.`;
    }
    return trouvees;
  }

  async function soumettre(e) {
    e.preventDefault();
    const trouvees = valider();
    setErreurs(trouvees);
    if (Object.keys(trouvees).length > 0) return;

    setEnCours(true);
    setErreur('');
    try {
      const agent = Object.fromEntries(Object.entries(champs).map(([k, v]) => [k, k === 'password' ? v : v.trim()]));
      const { user } = await api.creerUtilisateur(agent);
      onCree(user);
    } catch (err) {
      setErreur(err.message); // ex. 409 : matricule déjà utilisé
      setEnCours(false);
    }
  }

  const champ = (nom, libelle, type = 'text') => (
    <div className="champ-registre">
      <label htmlFor={`u-${nom}`}>{libelle}<span className="requis" aria-hidden="true"> *</span></label>
      <input
        id={`u-${nom}`}
        type={type}
        value={champs[nom]}
        onChange={modifier(nom)}
        autoComplete={type === 'password' ? 'new-password' : 'off'}
        aria-invalid={Boolean(erreurs[nom])}
        aria-describedby={erreurs[nom] ? `u-${nom}-erreur` : undefined}
      />
      {erreurs[nom] && <small id={`u-${nom}-erreur`} className="champ-erreur">{erreurs[nom]}</small>}
    </div>
  );

  return (
    <form className="carte pages-carte" onSubmit={soumettre} noValidate>
      <h2 className="pages-titre"><IconeAjoutPersonne taille={18} /> Nouveau compte</h2>
      <div className="formulaire-grille">
        {champ('first_name', 'Prénom')}
        {champ('last_name', 'Nom')}
        {champ('badge_number', 'Matricule')}
        {champ('email', 'Courriel', 'email')}
        {champ('password', 'Mot de passe initial', 'password')}
        <div className="champ-registre">
          <label htmlFor="u-role">Rôle</label>
          <select id="u-role" className="registre-select" value={champs.role} onChange={modifier('role')}>
            {ROLES.map((r) => <option key={r} value={r}>{LIBELLES_ROLE[r]}</option>)}
          </select>
        </div>
        <div className="champ-registre">
          <label htmlFor="u-grade">Grade</label>
          <select id="u-grade" className="registre-select" value={champs.grade} onChange={modifier('grade')}>
            {GRADES_PAR_ROLE[champs.role].map((g) => <option key={g} value={g}>{LIBELLES_GRADE[g]}</option>)}
          </select>
        </div>
      </div>
      {erreur && <p className="registre-message erreur" role="alert">{erreur}</p>}
      <div className="formulaire-actions">
        <button type="button" className="registre-lien" onClick={onAnnuler}>Annuler</button>
        <button type="submit" className="registre-bouton-principal" disabled={enCours}>
          {enCours ? 'Création…' : 'Créer le compte'}
        </button>
      </div>
    </form>
  );
}
