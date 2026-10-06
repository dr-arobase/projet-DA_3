import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as api from '../api.js';
import { useAuth } from '../composants/AuthContext.js';
import { useEvenement } from '../composants/TempsReelContext.js';
import {
  STATUTS, LIBELLES_STATUT, peutRetirer, nomComplet, formaterDate, formaterJour,
} from '../registre.js';
import '../styles/registre.css';

// Fiche complète d'un dossier (#5), changement de statut (#8) et retrait par un superviseur (#7)
export default function FicheDossier() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { utilisateur } = useAuth();

  const [dossier, setDossier] = useState(null);
  const [erreur, setErreur] = useState('');
  const [introuvable, setIntrouvable] = useState(false);
  const [retireParAutre, setRetireParAutre] = useState(false);

  const [nouveauStatut, setNouveauStatut] = useState('');
  const [message, setMessage] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [confirmerRetrait, setConfirmerRetrait] = useState(false);

  const afficher = useCallback((c) => {
    setDossier(c);
    setNouveauStatut(c.status);
  }, []);

  useEffect(() => {
    setDossier(null);
    setIntrouvable(false);
    setRetireParAutre(false);
    api.lireCriminel(id)
      .then(afficher)
      .catch((err) => (err.status === 404 ? setIntrouvable(true) : setErreur(err.message)));
  }, [id, afficher]);

  // Temps réel : la fiche suit les changements faits par les autres agents
  useEvenement('criminal:updated', useCallback((c) => {
    if (String(c.id) !== String(id)) return;
    setDossier((actuel) => {
      if (actuel && c.version > actuel.version) {
        setMessage({ type: 'info', texte: `Fiche mise à jour par ${c.updated_by ?? 'un autre agent'}.` });
      }
      return c;
    });
    setNouveauStatut(c.status);
  }, [id]));

  useEvenement('criminal:removed', useCallback(({ id: retire }) => {
    if (String(retire) === String(id)) setRetireParAutre(true);
  }, [id]));

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
          texte: `Ce dossier a été modifié entre-temps${actuel.updated_by ? ` par ${actuel.updated_by}` : ''} : `
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
              {dossier.photo_url ? (
                <img className="fiche-photo" src={dossier.photo_url} alt={`Photo de ${nomComplet(dossier)}`} />
              ) : (
                <div className="fiche-photo fiche-photo-vide" aria-hidden="true">
                  {`${dossier.first_name?.[0] ?? ''}${dossier.last_name?.[0] ?? ''}`.toUpperCase()}
                </div>
              )}
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
              <h2 className="fiche-titre">Historique</h2>
              <dl className="fiche-corps fiche-historique">
                <div><dt>Ajouté</dt><dd>{formaterDate(dossier.added_at, true)}{dossier.added_by && ` par ${dossier.added_by}`}</dd></div>
                <div><dt>Dernière modification</dt><dd>{formaterDate(dossier.updated_at, true)}{dossier.updated_by && ` par ${dossier.updated_by}`}</dd></div>
              </dl>
            </section>

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
