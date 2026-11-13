import { useState } from 'react';
import * as api from '../api.js';

const MAX_NOM = 100; // first_name, last_name, nationality : VARCHAR(100)

// Champs du formulaire, tirés du dossier affiché (la date arrive parfois avec l'heure)
const champsDe = (dossier) => ({
  first_name: dossier.first_name ?? '',
  last_name: dossier.last_name ?? '',
  date_of_birth: dossier.date_of_birth ? String(dossier.date_of_birth).slice(0, 10) : '',
  nationality: dossier.nationality ?? '',
  crimes: dossier.crimes ?? '',
  description: dossier.description ?? '',
});

// Modification complète d'un dossier (#98, FC2), réservée au superviseur et à la direction.
// La version du dossier AU MOMENT où l'agent a ouvert le formulaire part avec la demande : la fiche
// se met à jour en direct, et envoyer la version affichée au clic écraserait sans conflit ce qu'un
// autre agent vient d'enregistrer. Si un autre agent a modifié le dossier entre-temps,
// le serveur répond 409 avec l'état actuel : la fiche l'affiche aussitôt (onMisAJour), rien n'est
// écrasé, et le brouillon reste dans le formulaire pour que l'agent le vérifie avant de réessayer.
export default function ModifierDossier({ dossier, onMisAJour, desactive = false }) {
  const [ouvert, setOuvert] = useState(false);
  const [champs, setChamps] = useState(() => champsDe(dossier));
  const [versionLue, setVersionLue] = useState(dossier.version);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  function ouvrir() {
    setChamps(champsDe(dossier));
    setVersionLue(dossier.version);
    setMessage(null);
    setOuvert(true);
  }

  const changer = (champ) => (e) => setChamps((c) => ({ ...c, [champ]: e.target.value }));

  async function enregistrer(e) {
    e.preventDefault();
    if (!champs.first_name.trim() || !champs.last_name.trim()) {
      setMessage({ type: 'erreur', texte: 'Le prénom et le nom sont obligatoires.' });
      return;
    }
    setMessage(null);
    setEnCours(true);
    try {
      const { criminal } = await api.modifierCriminel(dossier.id, champs, versionLue);
      onMisAJour(criminal);
      setOuvert(false);
      setMessage({ type: 'succes', texte: 'Dossier mis à jour.' });
    } catch (err) {
      if (err.status === 409 && err.donnees?.criminal) {
        const actuel = err.donnees.criminal;
        onMisAJour(actuel);
        // L'agent a maintenant vu l'état actuel : s'il réessaie, c'est en connaissance de cause
        setVersionLue(actuel.version);
        setMessage({
          type: 'erreur',
          texte: `Ce dossier a été modifié entre-temps${actuel.updated_by ? ` par ${actuel.updated_by}` : ''}. `
            + 'La fiche affiche maintenant ses informations actuelles et vos changements n\'ont pas été appliqués. '
            + 'Ils sont encore dans le formulaire : vérifiez-les, puis enregistrez à nouveau.',
        });
      } else {
        setMessage({ type: 'erreur', texte: err.message });
      }
    } finally {
      setEnCours(false);
    }
  }

  if (!ouvert) {
    return (
      <div className="fiche-modifier">
        <button type="button" className="registre-lien" onClick={ouvrir} disabled={desactive}>
          Modifier le dossier
        </button>
        {message && (
          <p className={`registre-message ${message.type}`} role={message.type === 'erreur' ? 'alert' : 'status'}>
            {message.texte}
          </p>
        )}
      </div>
    );
  }

  return (
    <form className="fiche-formulaire fiche-modifier" onSubmit={enregistrer} noValidate aria-label="Modifier le dossier">
      <label htmlFor="modif-prenom">Prénom</label>
      <input id="modif-prenom" className="fiche-champ" maxLength={MAX_NOM} value={champs.first_name} onChange={changer('first_name')} />
      <label htmlFor="modif-nom">Nom</label>
      <input id="modif-nom" className="fiche-champ" maxLength={MAX_NOM} value={champs.last_name} onChange={changer('last_name')} />
      <label htmlFor="modif-naissance">Date de naissance</label>
      <input id="modif-naissance" type="date" className="fiche-champ" value={champs.date_of_birth} onChange={changer('date_of_birth')} />
      <label htmlFor="modif-nationalite">Nationalité</label>
      <input id="modif-nationalite" className="fiche-champ" maxLength={MAX_NOM} value={champs.nationality} onChange={changer('nationality')} />
      <label htmlFor="modif-crimes">Crimes reprochés</label>
      <textarea id="modif-crimes" className="fiche-champ" rows={2} value={champs.crimes} onChange={changer('crimes')} />
      <label htmlFor="modif-description">Description</label>
      <textarea id="modif-description" className="fiche-champ" rows={4} value={champs.description} onChange={changer('description')} />
      {message && (
        <p className={`registre-message ${message.type}`} role={message.type === 'erreur' ? 'alert' : 'status'}>
          {message.texte}
        </p>
      )}
      <div className="fiche-confirmation">
        <button type="submit" className="registre-bouton-principal" disabled={enCours || desactive}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button type="button" className="registre-lien" onClick={() => { setOuvert(false); setMessage(null); }} disabled={enCours}>
          Annuler
        </button>
      </div>
    </form>
  );
}
