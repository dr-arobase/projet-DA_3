import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import * as api from '../api.js';
import { useAuth } from '../composants/AuthContext.js';
import { useEvenement } from '../composants/TempsReelContext.js';
import {
  STATUTS, LIBELLES_STATUT, peutRetirer, nomComplet, formaterDate, formaterJour,
} from '../registre.js';
import { urlApi } from '../config.js';
import '../styles/registre.css';

// Fiche complète d'un dossier (#5), changement de statut (#8) et retrait par un superviseur (#7)
export default function FicheDossier() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { utilisateur } = useAuth();
  const location = useLocation();

  const [dossier, setDossier] = useState(null);
  const [erreur, setErreur] = useState('');
  const [introuvable, setIntrouvable] = useState(false);
  const [retireParAutre, setRetireParAutre] = useState(false);

  const [nouveauStatut, setNouveauStatut] = useState('');
  const [message, setMessage] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [confirmerRetrait, setConfirmerRetrait] = useState(false);

  // Dernière adresse connue (#64); l'avertissement peut venir de la page d'ajout
  const [adresse, setAdresse] = useState('');
  const [signalements, setSignalements] = useState([]);
  // null : pas encore chargés; false : l'agent n'a pas le droit de les voir (403), la section est cachée
  const [signalementsVisibles, setSignalementsVisibles] = useState(null);
  const [messageAdresse, setMessageAdresse] = useState(() =>
    (location.state?.avertissement ? { type: 'erreur', texte: location.state.avertissement } : null));

  const afficher = useCallback((c) => {
    setDossier(c);
    setNouveauStatut(c.status);
    setAdresse(c.last_known_address ?? '');
  }, []);

  useEffect(() => {
    setDossier(null);
    setIntrouvable(false);
    setRetireParAutre(false);
    api.lireCriminel(id)
      .then(afficher)
      .catch((err) => (err.status === 404 ? setIntrouvable(true) : setErreur(err.message)));
  }, [id, afficher]);

  useEffect(() => {
    setSignalementsVisibles(null);
    api.listerSignalementsDossier(id)
      .then((liste) => { setSignalements(liste); setSignalementsVisibles(true); })
      .catch((err) => {
        setSignalementsVisibles(false);
        if (err.status !== 403) setErreur(err.message);
      });
  }, [id]);

  // Temps réel : la fiche suit les changements faits par les autres agents
  useEvenement('criminal:updated', useCallback((c) => {
    if (String(c.id) !== String(id)) return;
    setDossier((actuel) => {
      if (actuel && c.version > actuel.version && c.status !== actuel.status) {
        setMessage({ type: 'info', texte: `Fiche mise à jour par ${c.updated_by ?? 'un autre agent'}.` });
      }
      return c;
    });
    setNouveauStatut(c.status);
  }, [id]));

  useEvenement('criminal:removed', useCallback(({ id: retire }) => {
    if (String(retire) === String(id)) setRetireParAutre(true);
  }, [id]));

  async function enregistrerAdresse(e) {
    e.preventDefault();
    setMessageAdresse(null);
    setEnCours(true);
    try {
      const { criminal, warning } = await api.changerAdresse(dossier.id, adresse.trim());
      afficher(criminal);
      setMessageAdresse(warning
        ? { type: 'erreur', texte: warning }
        : { type: 'succes', texte: criminal.last_known_address ? 'Adresse enregistrée et placée sur la carte.' : 'Adresse effacée.' });
    } catch (err) {
      setMessageAdresse({ type: 'erreur', texte: err.message });
    } finally {
      setEnCours(false);
    }
  }

  async function enregistrerStatut(e) {
    e.preventDefault();
    if (nouveauStatut === dossier.status) return;
    setMessage(null);
    setEnCours(true);
    try {
      // La version affichée part avec la demande : c'est le verrouillage optimiste
      const { criminal } = await api.changerStatut(dossier.id, nouveauStatut, dossier.version);
      afficher(criminal);
      setMessage({ type: 'succes', texte: `Statut changé : ${LIBELLES_STATUT[criminal.status]}.` });
    } catch (err) {
      if (err.status === 409 && err.donnees?.criminal) {
        // Quelqu'un a modifié le dossier entre-temps : on montre l'état réel, rien n'est écrasé
        const actuel = err.donnees.criminal;
        afficher(actuel);
        setMessage({
          type: 'erreur',
          texte: actuel.status === dossier.status
            ? `Ce dossier a été modifié entre-temps${actuel.updated_by ? ` par ${actuel.updated_by}` : ''} (adresse ou autre information). Votre changement de statut n'a pas été appliqué.`
            : `Ce dossier a été modifié entre-temps${actuel.updated_by ? ` par ${actuel.updated_by}` : ''} : `
              + `son statut est maintenant « ${LIBELLES_STATUT[actuel.status]} ». Votre changement n'a pas été appliqué.`,
        });
      } else {
        setMessage({ type: 'erreur', texte: err.message });
      }
    } finally {
      setEnCours(false);
    }
  }

  async function retirer() {
    setMessage(null);
    setEnCours(true);
    try {
      await api.retirerCriminel(dossier.id);
      navigate('/personnes-recherchees', { replace: true, state: { retire: nomComplet(dossier) } });
    } catch (err) {
      setMessage({ type: 'erreur', texte: err.message });
      setEnCours(false);
      setConfirmerRetrait(false);
    }
  }

  if (introuvable) {
    return (
      <div className="page page-vide">
        <h1>Dossier introuvable</h1>
        <p>Ce dossier n'existe pas ou a été retiré du registre.</p>
        <Link to="/personnes-recherchees">Retour au registre</Link>
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="page">
        {erreur ? <p className="erreur" role="alert">{erreur}</p> : <p>Chargement…</p>}
      </div>
    );
  }

  const modifiable = !retireParAutre && !enCours;

  return (
    <>
      <header className="entete-registre">
        <div>
          <Link to="/personnes-recherchees" className="registre-retour">← Registre</Link>
          <h1>{nomComplet(dossier)}</h1>
          <p>Dossier n° {dossier.id} · version {dossier.version}</p>
        </div>
        <span className={`statut statut-${dossier.status} statut-grand`}>{LIBELLES_STATUT[dossier.status]}</span>
      </header>

      <div className="page">
        {retireParAutre && (
          <p className="erreur" role="alert">
            Ce dossier vient d'être retiré du registre par un superviseur. <Link to="/personnes-recherchees">Retour au registre</Link>
          </p>
        )}

        <div className="fiche-grille">
          <section className="carte fiche-carte">
            <h2 className="fiche-titre">Identité et signalement</h2>
            <div className="fiche-corps">
              <PhotoDossier dossier={dossier} peutLaRetirer={peutRetirer(utilisateur)} onMisAJour={afficher} />
              <dl className="fiche-champs">
                <div><dt>Prénom</dt><dd>{dossier.first_name}</dd></div>
                <div><dt>Nom</dt><dd>{dossier.last_name}</dd></div>
                <div><dt>Date de naissance</dt><dd>{formaterJour(dossier.date_of_birth)}</dd></div>
                <div><dt>Nationalité</dt><dd>{dossier.nationality || '—'}</dd></div>
                <div className="complet"><dt>Crimes reprochés</dt><dd>{dossier.crimes || '—'}</dd></div>
                <div className="complet"><dt>Description</dt><dd className="texte-long">{dossier.description || '—'}</dd></div>
              </dl>
            </div>
          </section>

          <aside className="fiche-cote">
            <section className="carte fiche-carte">
              <h2 className="fiche-titre">Statut</h2>
              <form className="fiche-corps fiche-formulaire" onSubmit={enregistrerStatut}>
                <label htmlFor="statut">Nouveau statut</label>
                <select
                  id="statut"
                  className="registre-select"
                  value={nouveauStatut}
                  onChange={(e) => setNouveauStatut(e.target.value)}
                  disabled={!modifiable}
                >
                  {STATUTS.map((s) => <option key={s} value={s}>{LIBELLES_STATUT[s]}</option>)}
                </select>
                <button
                  type="submit"
                  className="registre-bouton-principal"
                  disabled={!modifiable || nouveauStatut === dossier.status}
                >
                  {enCours ? 'Enregistrement…' : 'Mettre à jour le statut'}
                </button>
                {message && (
                  <p className={`registre-message ${message.type}`} role={message.type === 'erreur' ? 'alert' : 'status'}>
                    {message.texte}
                  </p>
                )}
              </form>
            </section>

            <section className="carte fiche-carte">
              <h2 className="fiche-titre">Dernière adresse connue</h2>
              <form className="fiche-corps fiche-formulaire" onSubmit={enregistrerAdresse}>
                <label htmlFor="adresse">Adresse</label>
                <input
                  id="adresse"
                  className="fiche-champ"
                  maxLength={255}
                  placeholder="Ex. : 3800 rue Sherbrooke Est, Montréal"
                  value={adresse}
                  onChange={(e) => setAdresse(e.target.value)}
                  disabled={!modifiable}
                />
                <button
                  type="submit"
                  className="registre-bouton-principal"
                  disabled={!modifiable || adresse.trim() === (dossier.last_known_address ?? '')}
                >
                  Enregistrer l'adresse
                </button>
                {dossier.latitude !== null && dossier.latitude !== undefined && (
                  <Link to={`/carte?dossier=${dossier.id}`} className="registre-lien">Voir sur la carte</Link>
                )}
                {messageAdresse && (
                  <p className={`registre-message ${messageAdresse.type}`} role={messageAdresse.type === 'erreur' ? 'alert' : 'status'}>
                    {messageAdresse.texte}
                  </p>
                )}
              </form>
            </section>

            <section className="carte fiche-carte">
              <h2 className="fiche-titre">Historique</h2>
              <dl className="fiche-corps fiche-historique">
                <div><dt>Ajouté</dt><dd>{formaterDate(dossier.added_at, true)}{dossier.added_by && ` par ${dossier.added_by}`}</dd></div>
                <div><dt>Dernière modification</dt><dd>{formaterDate(dossier.updated_at, true)}{dossier.updated_by && ` par ${dossier.updated_by}`}</dd></div>
              </dl>
            </section>

            {signalementsVisibles && (
            <section className="carte fiche-carte">
              <h2 className="fiche-titre">Signalements récents</h2>
              <div className="fiche-corps">
                {signalements.length === 0 ? <p>Aucun signalement enregistré.</p> : (
                  <ul className="fiche-signalements">
                    {signalements.map((s) => (
                      <li key={s.id}>
                        <strong>{s.location}</strong>
                        <span>{formaterDate(s.reported_at, true)} · {s.reported_by ?? '—'}</span>
                        {s.notes && <small>{s.notes}</small>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
            )}

            {peutRetirer(utilisateur) && (
              <section className="carte fiche-carte fiche-danger">
                <h2 className="fiche-titre">Retirer du registre</h2>
                <div className="fiche-corps">
                  <p>Le dossier et ses signalements sont supprimés pour tous les agents. L'action est inscrite au journal d'audit.</p>
                  {confirmerRetrait ? (
                    <div className="fiche-confirmation">
                      <button type="button" className="registre-bouton-danger" onClick={retirer} disabled={!modifiable}>
                        {enCours ? 'Retrait…' : 'Confirmer le retrait'}
                      </button>
                      <button type="button" className="registre-lien" onClick={() => setConfirmerRetrait(false)} disabled={enCours}>
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="registre-bouton-danger" onClick={() => setConfirmerRetrait(true)} disabled={!modifiable}>
                      Retirer ce dossier
                    </button>
                  )}
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

const TYPES_PHOTO = ['image/jpeg', 'image/png', 'image/webp'];
const TAILLE_MAX_PHOTO = 2 * 1024 * 1024;

// Photo du dossier (ou ses initiales) : tout agent l'ajoute ou la change; un superviseur peut la retirer
function PhotoDossier({ dossier, peutLaRetirer, onMisAJour }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [urlEnErreur, setUrlEnErreur] = useState(null);
  const url = dossier.photo_url ? urlApi(dossier.photo_url) : null;

  async function agir(action) {
    setEnCours(true);
    setErreur('');
    try {
      const { criminal } = await action();
      onMisAJour(criminal);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  }

  function choisir(e) {
    const fichier = e.target.files?.[0];
    e.target.value = '';
    if (!fichier) return;
    if (!TYPES_PHOTO.includes(fichier.type)) { setErreur('Choisissez une image JPG, PNG ou WebP.'); return; }
    if (fichier.size > TAILLE_MAX_PHOTO) { setErreur('La photo dépasse 2 Mo.'); return; }
    agir(() => api.envoyerPhotoDossier(dossier.id, fichier));
  }

  return (
    <div className="fiche-photo-bloc">
      {url && url !== urlEnErreur ? (
        <img className="fiche-photo" src={url} alt={`Photo de ${nomComplet(dossier)}`} onError={() => setUrlEnErreur(url)} />
      ) : (
        <div className="fiche-photo fiche-photo-vide" aria-hidden="true">
          {`${dossier.first_name?.[0] ?? ''}${dossier.last_name?.[0] ?? ''}`.toUpperCase()}
        </div>
      )}
      <div className="fiche-photo-actions">
        <label className="registre-lien">
          {dossier.photo_url ? 'Changer la photo' : 'Ajouter une photo'}
          <input type="file" accept={TYPES_PHOTO.join(',')} hidden disabled={enCours} onChange={choisir} />
        </label>
        {dossier.photo_url && peutLaRetirer && (
          <button type="button" className="registre-lien" disabled={enCours} onClick={() => agir(() => api.supprimerPhotoDossier(dossier.id))}>
            Retirer la photo
          </button>
        )}
      </div>
      {erreur && <p className="registre-message erreur" role="alert">{erreur}</p>}
    </div>
  );
}
