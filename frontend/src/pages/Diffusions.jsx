import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../api.js';
import { useAuth } from '../composants/AuthContext.js';
import { useEvenement } from '../composants/TempsReelContext.js';
import { IconeMegaphone, IconeSirene } from '../composants/Icones.jsx';
import { estAuMoins } from '../agents.js';
import RechercheDossier from '../composants/RechercheDossier.jsx';
import ElementDiffusion from '../composants/ElementDiffusion.jsx';
import '../styles/registre.css';
import '../styles/pages.css';

const PAR_PAGE = 20;

// Une alerte est une diffusion « urgent », un communiqué une diffusion « info » (table alert)
const TYPES = {
  urgent: {
    titre: 'Alertes',
    sousTitre: 'Alertes urgentes diffusées à tous les agents',
    action: 'Diffuser une alerte',
    vide: 'Aucune alerte diffusée.',
    videRetirees: 'Aucune alerte retirée.',
    Icone: IconeSirene,
  },
  info: {
    titre: 'Communiqués',
    sousTitre: 'Informations diffusées à tous les agents',
    action: 'Diffuser un communiqué',
    vide: 'Aucun communiqué diffusé.',
    videRetirees: 'Aucun communiqué retiré.',
    Icone: IconeMegaphone,
  },
};

// Alertes (#12) et communiqués : liste en temps réel. Tout agent diffuse une alerte;
// un communiqué est réservé au superviseur et à la direction (#202 : l'API refuse aussi, 403).
// #220 : l'auteur ou la direction modifie et retire une diffusion. Retirer = archiver :
// elle passe dans « Retirées », d'où on peut la remettre. Tout se voit en direct chez tous les agents.
export default function Diffusions({ severite }) {
  const type = TYPES[severite];
  const { utilisateur } = useAuth();
  const peutDiffuser = severite === 'urgent' || estAuMoins(utilisateur, 'superviseur');

  const [diffusions, setDiffusions] = useState([]);
  // Copie synchrone de la liste : un même changement reçu deux fois (sa propre action,
  // puis l'événement en direct) n'est appliqué qu'une fois, et le total reste juste
  const liste = useRef([]);
  const majListe = useCallback((changer) => {
    liste.current = changer(liste.current);
    setDiffusions(liste.current);
  }, []);
  const [retirees, setRetirees] = useState(false); // false : en cours; true : retirées (archives)
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
    api.listerAlertes({ severity: severite, page, limit: PAR_PAGE, archived: retirees ? 'true' : undefined })
      .then((resultat) => {
        if (!actif) return;
        majListe(() => resultat.data);
        setTotal(resultat.total ?? resultat.data.length);
        if (page === 1) setNouvelles(0);
      })
      .catch((err) => actif && setErreur(err.message))
      .finally(() => actif && setChargement(false));
    return () => { actif = false; };
  }, [severite, page, retirees, majListe]);

  useEffect(() => setPage(1), [severite, retirees]);

  const totalPages = Math.max(1, Math.ceil(total / PAR_PAGE));

  // Une nouvelle diffusion va en tête de la page 1 (la plus récente). Sur une page plus ancienne,
  // on ne la glisse pas au milieu : un bandeau propose de revenir à la page 1.
  const recevoir = useCallback((a) => {
    if (liste.current.some((x) => x.id === a.id)) return;
    setTotal((t) => t + 1);
    if (page === 1) {
      majListe((enCours) => [a, ...enCours].slice(0, PAR_PAGE));
    } else {
      setNouvelles((n) => n + 1);
    }
  }, [page, majListe]);

  // Une diffusion modifiée : remplacée sur place si elle est affichée
  const remplacer = useCallback((a) => {
    majListe((enCours) => enCours.map((x) => (x.id === a.id ? a : x)));
  }, [majListe]);

  // Une diffusion qui quitte la vue (retirée, ou remise depuis les retirées)
  const enlever = useCallback((a) => {
    if (!liste.current.some((x) => x.id === a.id)) return;
    majListe((enCours) => enCours.filter((x) => x.id !== a.id));
    setTotal((t) => Math.max(0, t - 1));
  }, [majListe]);

  // Une diffusion qui arrive dans la vue (remise, ou retirée pour la vue des retirées) :
  // à sa place dans l'ordre de la liste, si elle tombe dans la page affichée
  const inserer = useCallback((a) => {
    if (liste.current.some((x) => x.id === a.id)) return;
    setTotal((t) => t + 1);
    const cle = retirees ? 'archived_at' : 'created_at';
    const enCours = liste.current;
    const dernier = enCours[enCours.length - 1];
    const dansLaPage = page === 1 || (dernier && a[cle] >= dernier[cle]);
    if (!dansLaPage) return;
    majListe(() => [...enCours, a].sort((x, y) => (y[cle] > x[cle] ? 1 : -1)).slice(0, PAR_PAGE));
  }, [page, retirees, majListe]);

  // Ce qui est fait ailleurs (autre agent, autre onglet) apparaît sans recharger
  useEvenement('alert:broadcast', useCallback((a) => {
    if (a.severity === severite && !retirees) recevoir(a);
  }, [severite, retirees, recevoir]));
  useEvenement('alert:updated', remplacer);
  useEvenement('alert:archived', useCallback((a) => {
    if (a.severity !== severite) return;
    if (retirees) inserer(a); else enlever(a);
  }, [severite, retirees, inserer, enlever]));
  useEvenement('alert:restored', useCallback((a) => {
    if (a.severity !== severite) return;
    if (retirees) enlever(a); else inserer(a);
  }, [severite, retirees, inserer, enlever]));

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
      // Sa propre diffusion : on revient aux diffusions en cours, page 1, pour la voir en tête
      if (page === 1 && !retirees) recevoir(alert);
      else { setRetirees(false); setPage(1); }
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
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                aria-invalid={Boolean(envoi.erreur)}
              />
              <small className="registre-note">{message.length} caractère{message.length > 1 ? 's' : ''}, sans limite</small>
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

        <div className="diffusion-vues" role="group" aria-label="Diffusions affichées">
          <button type="button" aria-pressed={!retirees} onClick={() => setRetirees(false)}>En cours</button>
          <button type="button" aria-pressed={retirees} onClick={() => setRetirees(true)}>Retirées</button>
        </div>

        {nouvelles > 0 && !retirees && (
          <button type="button" className="pages-nouvelles" onClick={() => setPage(1)}>
            {nouvelles} {nouvelles > 1 ? 'nouvelles diffusions' : 'nouvelle diffusion'} : revenir à la page 1
          </button>
        )}

        <ul className="pages-fil">
          {diffusions.map((a) => (
            <ElementDiffusion
              key={a.id}
              diffusion={a}
              utilisateur={utilisateur}
              onChange={remplacer}
              onRetiree={enlever}
              onRemise={enlever}
            />
          ))}
          {!chargement && diffusions.length === 0 && (
            <li className="carte pages-vide">{retirees ? type.videRetirees : type.vide}</li>
          )}
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
