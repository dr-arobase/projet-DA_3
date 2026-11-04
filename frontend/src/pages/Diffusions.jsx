import { useCallback, useEffect, useState } from 'react';
import * as api from '../api.js';
import { useAuth } from '../composants/AuthContext.js';
import { useEvenement } from '../composants/TempsReelContext.js';
import { IconeMegaphone, IconeSirene } from '../composants/Icones.jsx';
import { estAuMoins } from '../agents.js';
import { formaterDate } from '../registre.js';
import RechercheDossier from '../composants/RechercheDossier.jsx';
import '../styles/registre.css';
import '../styles/pages.css';

const MAX_MESSAGE = 500; // alert.message VARCHAR(500)
const PAR_PAGE = 20;

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
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [nouvelles, setNouvelles] = useState(0); // arrivées en direct pendant qu'on lit une page plus ancienne
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [dossier, setDossier] = useState(null);
  const [envoi, setEnvoi] = useState({ enCours: false, erreur: '', succes: '' });

  useEffect(() => {
    let actif = true;
    setChargement(true);
    api.listerAlertes({ severity: severite, page, limit: PAR_PAGE })
      .then((resultat) => {
        if (!actif) return;
        setDiffusions(resultat.data);
        setTotal(resultat.total ?? resultat.data.length);
        if (page === 1) setNouvelles(0);
      })
      .catch((err) => actif && setErreur(err.message))
      .finally(() => actif && setChargement(false));
    return () => { actif = false; };
  }, [severite, page]);

  useEffect(() => setPage(1), [severite]);

  const totalPages = Math.max(1, Math.ceil(total / PAR_PAGE));

  // Une nouvelle diffusion va en tête de la page 1 (la plus récente). Sur une page plus ancienne,
  // on ne la glisse pas au milieu : un bandeau propose de revenir à la page 1.
  const recevoir = useCallback((a) => {
    setTotal((t) => t + 1);
    if (page === 1) {
      setDiffusions((enCours) => [a, ...enCours.filter((x) => x.id !== a.id)].slice(0, PAR_PAGE));
    } else {
      setNouvelles((n) => n + 1);
    }
  }, [page]);

  // Une diffusion faite ailleurs (autre agent, autre onglet) apparaît sans recharger
  useEvenement('alert:broadcast', useCallback((a) => {
    if (a.severity === severite) recevoir(a);
  }, [severite, recevoir]));

  async function diffuser(e) {
    e.preventDefault();
    const texte = message.trim();
    if (!texte) {
      setEnvoi({ enCours: false, erreur: 'Le message est obligatoire.', succes: '' });
      return;
    }
    setEnvoi({ enCours: true, erreur: '', succes: '' });
    try {
      const { alert } = await api.diffuserAlerte(texte, severite, dossier?.id);
      // Sa propre diffusion : on revient en page 1 pour la voir en tête
      if (page === 1) recevoir(alert); else setPage(1);
      setMessage('');
      setDossier(null);
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
            <div className="champ-registre complet">
              <label htmlFor="alerte-dossier">Dossier lié (facultatif)</label>
              <RechercheDossier id="alerte-dossier" valeur={dossier} onChange={setDossier} />
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

        {nouvelles > 0 && (
          <button type="button" className="pages-nouvelles" onClick={() => setPage(1)}>
            {nouvelles} {nouvelles > 1 ? 'nouvelles diffusions' : 'nouvelle diffusion'} : revenir à la page 1
          </button>
        )}

        <ul className="pages-fil">
          {diffusions.map((a) => (
            <li key={a.id} className={`carte pages-diffusion${severite === 'urgent' ? ' urgent' : ''}`}>
              <p>{a.message}</p>
              {a.criminal_id && <small>Dossier : {a.criminal_name ?? `n° ${a.criminal_id}`}</small>}
              <small>{a.issued_by ?? '—'} · {formaterDate(a.created_at, true)}</small>
            </li>
          ))}
          {!chargement && diffusions.length === 0 && <li className="carte pages-vide">{type.vide}</li>}
          {chargement && diffusions.length === 0 && <li className="carte pages-vide">Chargement…</li>}
        </ul>
        {totalPages > 1 && (
          <nav className="pagination" aria-label="Pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Précédente</button>
            <span>Page {page} sur {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Suivante →</button>
          </nav>
        )}
      </div>
    </>
  );
}
