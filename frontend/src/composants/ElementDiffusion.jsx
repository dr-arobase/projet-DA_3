import { useState } from 'react';
import * as api from '../api.js';
import { formaterDate } from '../registre.js';

// L'auteur d'une diffusion, ou la direction, peut la modifier et la retirer (#220).
// L'API applique la même règle (403 sinon) : ici, on cache seulement les boutons inutiles.
export const peutGerer = (diffusion, utilisateur) =>
  Boolean(utilisateur) && (diffusion.issued_by_id === utilisateur.id || utilisateur.role === 'direction');

// Une alerte ou un communiqué dans la liste : texte, mention « modifié », puis Modifier / Retirer
// (ou Remettre, pour une diffusion retirée). onChange reçoit la diffusion à jour,
// onRetiree (ou onRemise) est appelé quand elle quitte la liste affichée.
export default function ElementDiffusion({ diffusion: a, utilisateur, onChange, onRetiree, onRemise }) {
  const [edition, setEdition] = useState(null); // texte en cours de modification, ou null
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const gerable = peutGerer(a, utilisateur);
  const retiree = Boolean(a.archived_at);
  const urgent = a.severity === 'urgent';

  async function agir(action) {
    setEnCours(true);
    setErreur('');
    try {
      await action();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  }

  const enregistrer = (e) => {
    e.preventDefault();
    const texte = edition.trim();
    if (!texte) {
      setErreur('Le message est obligatoire.');
      return;
    }
    agir(async () => {
      const { alert } = await api.modifierAlerte(a.id, texte);
      onChange?.(alert);
      setEdition(null);
    });
  };

  const retirer = () => agir(async () => {
    const { alert } = await api.retirerAlerte(a.id);
    onRetiree?.(alert);
  });

  const remettre = () => agir(async () => {
    const { alert } = await api.remettreAlerte(a.id);
    onRemise?.(alert);
  });

  return (
    <li className={`carte pages-diffusion${urgent ? ' urgent' : ''}`}>
      <span className={`diffusion-gravite ${a.severity}`}>{urgent ? 'Urgent' : 'Info'}</span>

      {edition === null ? (
        <p>{a.message}</p>
      ) : (
        <form className="diffusion-edition" onSubmit={enregistrer} noValidate>
          <label htmlFor={`diffusion-${a.id}`} className="visuellement-cache">Nouveau texte</label>
          <textarea
            id={`diffusion-${a.id}`}
            rows={4}
            value={edition}
            onChange={(e) => setEdition(e.target.value)}
            aria-invalid={Boolean(erreur)}
          />
          <div className="diffusion-actions">
            <button type="submit" className="registre-bouton-principal" disabled={enCours}>
              {enCours ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button type="button" className="diffusion-bouton" onClick={() => { setEdition(null); setErreur(''); }}>
              Annuler
            </button>
          </div>
        </form>
      )}

      {a.criminal_id && <small>Dossier : {a.criminal_name ?? `n° ${a.criminal_id}`}</small>}
      <small>{a.issued_by ?? '—'} · {formaterDate(a.created_at, true)}</small>
      {a.edited_at && (
        <small className="diffusion-modifiee">
          Modifié le {formaterDate(a.edited_at, true)}{a.edited_by ? ` par ${a.edited_by}` : ''}
        </small>
      )}
      {retiree && (
        <small>Retiré le {formaterDate(a.archived_at, true)}{a.archived_by ? ` par ${a.archived_by}` : ''}</small>
      )}

      {erreur && <p className="registre-message erreur" role="alert">{erreur}</p>}

      {gerable && edition === null && (
        <div className="diffusion-actions">
          {retiree ? (
            <button type="button" className="diffusion-bouton" onClick={remettre} disabled={enCours}>
              Remettre
            </button>
          ) : (
            <>
              <button type="button" className="diffusion-bouton" onClick={() => setEdition(a.message)} disabled={enCours}>
                Modifier
              </button>
              <button type="button" className="diffusion-bouton retirer" onClick={retirer} disabled={enCours}>
                Retirer
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );
}
