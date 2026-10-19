import { useCallback, useEffect, useState } from 'react';
import * as api from '../api.js';
import { useAuth } from '../composants/AuthContext.js';
import { useEvenement } from '../composants/TempsReelContext.js';
import { IconeMegaphone, IconeSirene } from '../composants/Icones.jsx';
import { estAuMoins } from '../agents.js';
import { formaterDate } from '../registre.js';
import '../styles/registre.css';
import '../styles/pages.css';

const MAX_MESSAGE = 500; // alert.message VARCHAR(500)

// Une alerte est une diffusion « urgent », un communiqué une diffusion « info » (table alert)
const TYPES = {
  urgent: {
    titre: 'Alertes',
    sousTitre: 'Alertes urgentes diffusées à tous les agents',
    action: 'Diffuser une alerte',
    vide: 'Aucune alerte diffusée.',
    Icone: IconeSirene,
  },
  info: {
    titre: 'Communiqués',
    sousTitre: 'Informations diffusées à tous les agents',
    action: 'Diffuser un communiqué',
    vide: 'Aucun communiqué diffusé.',
    Icone: IconeMegaphone,
  },
};

// Alertes (#12) et communiqués : liste en temps réel, diffusion réservée aux superviseurs et à la direction
export default function Diffusions({ severite }) {
  const type = TYPES[severite];
  const { utilisateur } = useAuth();
  const peutDiffuser = estAuMoins(utilisateur, 'superviseur');

  const [diffusions, setDiffusions] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [envoi, setEnvoi] = useState({ enCours: false, erreur: '', succes: '' });

  useEffect(() => {
    let actif = true;
    setChargement(true);
    // L'API ne filtre pas par sévérité : on prend les 100 dernières et on trie ici
    api.listerAlertes({ limit: 100 })
      .then(({ data }) => actif && setDiffusions(data.filter((a) => a.severity === severite)))
      .catch((err) => actif && setErreur(err.message))
      .finally(() => actif && setChargement(false));
    return () => { actif = false; };
  }, [severite]);

  // Une diffusion faite ailleurs (autre agent, autre onglet) apparaît sans recharger
  useEvenement('alert:broadcast', useCallback((a) => {
    if (a.severity !== severite) return;
    setDiffusions((enCours) => [a, ...enCours.filter((x) => x.id !== a.id)]);
  }, [severite]));

  async function diffuser(e) {
    e.preventDefault();
    const texte = message.trim();
    if (!texte) {
      setEnvoi({ enCours: false, erreur: 'Le message est obligatoire.', succes: '' });
      return;
    }
    setEnvoi({ enCours: true, erreur: '', succes: '' });
    try {
      const { alert } = await api.diffuserAlerte(texte, severite);
      setDiffusions((enCours) => [alert, ...enCours.filter((x) => x.id !== alert.id)]);
      setMessage('');
      setEnvoi({ enCours: false, erreur: '', succes: 'Diffusé à tous les agents connectés.' });
    } catch (err) {
      setEnvoi({ enCours: false, erreur: err.message, succes: '' });
    }
  }

  return (
    <>
      <header className="entete-registre">
        <div>
          <h1>{type.titre}</h1>
          <p>{type.sousTitre}</p>
        </div>
      </header>

      <div className="page pages-colonne">
        {peutDiffuser && (
          <form className="carte pages-carte" onSubmit={diffuser} noValidate>
            <h2 className="pages-titre"><type.Icone taille={18} /> {type.action}</h2>
            <div className="champ-registre complet">
              <label htmlFor="message">Message<span className="requis" aria-hidden="true"> *</span></label>
              <textarea
                id="message"
                rows={3}
                maxLength={MAX_MESSAGE}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                aria-invalid={Boolean(envoi.erreur)}
              />
              <small className="registre-note">{message.length} / {MAX_MESSAGE}</small>
            </div>
            {envoi.erreur && <p className="registre-message erreur" role="alert">{envoi.erreur}</p>}
            {envoi.succes && <p className="registre-message succes" role="status">{envoi.succes}</p>}
            <div className="formulaire-actions">
              <button
                type="submit"
                className={severite === 'urgent' ? 'registre-bouton-danger' : 'registre-bouton-principal'}
                disabled={envoi.enCours}
              >
                {envoi.enCours ? 'Diffusion…' : 'Diffuser'}
              </button>
            </div>
          </form>
        )}

        {erreur && <p className="registre-message erreur" role="alert">{erreur}</p>}

        <ul className="pages-fil">
          {diffusions.map((a) => (
            <li key={a.id} className={`carte pages-diffusion${severite === 'urgent' ? ' urgent' : ''}`}>
              <p>{a.message}</p>
              <small>{a.issued_by ?? '—'} · {formaterDate(a.created_at, true)}</small>
            </li>
          ))}
          {!chargement && diffusions.length === 0 && <li className="carte pages-vide">{type.vide}</li>}
          {chargement && diffusions.length === 0 && <li className="carte pages-vide">Chargement…</li>}
        </ul>
      </div>
    </>
  );
}
