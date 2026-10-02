import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '../api.js';
import { IconeEnregistrer } from '../composants/Icones.jsx';
import '../styles/registre.css';

const VIDE = {
  first_name: '', last_name: '', date_of_birth: '', nationality: '', crimes: '', description: '',
};

// Longueurs maximales des colonnes de criminal (voir database/schema.sql)
const MAX = { first_name: 100, last_name: 100, nationality: 100 };

// Ajout d'un dossier au registre (#6) : visible aussitôt par tous les agents connectés
export default function NouveauDossier() {
  const navigate = useNavigate();
  const [champs, setChamps] = useState(VIDE);
  const [erreurs, setErreurs] = useState({});
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const modifier = (champ) => (e) => setChamps((c) => ({ ...c, [champ]: e.target.value }));

  function valider() {
    const e = {};
    if (!champs.first_name.trim()) e.first_name = 'Le prénom est obligatoire.';
    if (!champs.last_name.trim()) e.last_name = 'Le nom est obligatoire.';
    if (champs.date_of_birth && champs.date_of_birth > new Date().toISOString().slice(0, 10)) {
      e.date_of_birth = 'La date de naissance ne peut pas être dans le futur.';
    }
    return e;
  }

  async function soumettre(e) {
    e.preventDefault();
    setErreur('');
    const trouvees = valider();
    setErreurs(trouvees);
    if (Object.keys(trouvees).length) return;

    setEnCours(true);
    try {
      const dossier = Object.fromEntries(Object.entries(champs).map(([k, v]) => [k, v.trim() || undefined]));
      const { criminal } = await api.creerCriminel(dossier);
      navigate(`/personnes-recherchees/${criminal.id}`, { replace: true });
    } catch (err) {
      setErreur(err.message);
      setEnCours(false);
    }
  }

  const champ = (nom, libelle, props = {}) => (
    <div className={`champ-registre${props.complet ? ' complet' : ''}`}>
      <label htmlFor={nom}>{libelle}{props.requis && <span className="requis" aria-hidden="true"> *</span>}</label>
      {props.multiligne ? (
        <textarea id={nom} rows={4} value={champs[nom]} onChange={modifier(nom)} />
      ) : (
        <input
          id={nom}
          type={props.type ?? 'text'}
          value={champs[nom]}
          onChange={modifier(nom)}
          maxLength={MAX[nom]}
          required={props.requis}
          aria-invalid={Boolean(erreurs[nom])}
          aria-describedby={erreurs[nom] ? `${nom}-erreur` : undefined}
        />
      )}
      {erreurs[nom] && <small id={`${nom}-erreur`} className="champ-erreur">{erreurs[nom]}</small>}
    </div>
  );

  return (
    <>
      <header className="entete-registre">
        <div>
          <Link to="/personnes-recherchees" className="registre-retour">← Registre</Link>
          <h1>Nouvelle fiche</h1>
          <p>Le dossier sera visible immédiatement par tous les agents connectés.</p>
        </div>
      </header>

      <div className="page">
        <form className="carte fiche-carte formulaire-dossier" onSubmit={soumettre} noValidate>
          <div className="fiche-corps">
            <div className="formulaire-grille">
              {champ('first_name', 'Prénom', { requis: true })}
              {champ('last_name', 'Nom', { requis: true })}
              {champ('date_of_birth', 'Date de naissance', { type: 'date' })}
              {champ('nationality', 'Nationalité')}
              {champ('crimes', 'Crimes reprochés', { complet: true })}
              {champ('description', 'Description, signes distinctifs, dernier lieu connu', { complet: true, multiligne: true })}
            </div>

            <p className="registre-note">Le statut de départ est « Recherché ». Les champs marqués * sont obligatoires.</p>
            {erreur && <p className="registre-message erreur" role="alert">{erreur}</p>}

            <div className="formulaire-actions">
              <Link to="/personnes-recherchees" className="registre-lien">Annuler</Link>
              <button type="submit" className="registre-bouton-principal" disabled={enCours}>
                <IconeEnregistrer taille={17} />
                {enCours ? 'Enregistrement…' : 'Ajouter au registre'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
