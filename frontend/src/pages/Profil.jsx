import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../composants/AuthContext.js';
import * as api from '../api.js';
import Avatar from '../composants/Avatar.jsx';
import {
  IconeUtilisateur, IconeCourriel, IconeCalendrier, IconeCadenas, IconeEnregistrer, IconeAppareilPhoto,
} from '../composants/Icones.jsx';
import '../styles/profil.css';

// Valeurs de app_user.role et app_user.grade (voir database/schema.sql)
const LIBELLES_ROLE = {
  direction: 'Direction',
  superviseur: 'Superviseur',
  policier: 'Policier',
};

const LIBELLES_GRADE = {
  sergent_autres_fonctions: 'Sergent (autres fonctions)',
  sergent_gestionnaire: 'Sergent gestionnaire',
  sergent_responsable_de_poste: 'Sergent responsable de poste',
  lieutenant: 'Lieutenant',
  capitaine: 'Capitaine',
  inspecteur: 'Inspecteur',
  inspecteur_chef: 'Inspecteur-chef',
  directeur_general_adjoint: 'Directeur général adjoint',
  directeur_general: 'Directeur général',
};

// Mêmes règles que le backend (POST /api/auth/change-password, PUT /api/auth/avatar)
const LONGUEUR_MIN = 8;
const TYPES_PHOTO = ['image/jpeg', 'image/png', 'image/webp'];
const TAILLE_MAX_PHOTO = 2 * 1024 * 1024;

const MOTS_DE_PASSE_VIDES = { actuel: '', nouveau: '', confirmation: '' };

function formaterDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function Profil() {
  const { utilisateur, mettreAJourUtilisateur } = useAuth();
  const [erreurProfil, setErreurProfil] = useState('');

  const champPhoto = useRef(null);
  const [messagePhoto, setMessagePhoto] = useState(null);
  const [envoiPhoto, setEnvoiPhoto] = useState(false);

  const [motsDePasse, setMotsDePasse] = useState(MOTS_DE_PASSE_VIDES);
  const [message, setMessage] = useState(null);
  const [enCours, setEnCours] = useState(false);

  // La session mémorisée au login ne contient pas le courriel ni la date de création : on relit le profil complet
  useEffect(() => {
    api.moi()
      .then(({ user }) => mettreAJourUtilisateur(user))
      .catch((err) => setErreurProfil(err.message));
  }, []);

  if (!utilisateur) return null;

  const prenom = utilisateur.first_name ?? '';
  const nom = utilisateur.last_name ?? '';
  const role = utilisateur.role?.toLowerCase();

  async function changerPhoto(e) {
    const fichier = e.target.files?.[0];
    e.target.value = ''; // permet de rechoisir le même fichier
    if (!fichier) return;
    setMessagePhoto(null);

    if (!TYPES_PHOTO.includes(fichier.type)) {
      setMessagePhoto({ type: 'erreur', texte: 'Choisissez une image JPG, PNG ou WebP.' });
      return;
    }
    if (fichier.size > TAILLE_MAX_PHOTO) {
      setMessagePhoto({ type: 'erreur', texte: 'Image trop volumineuse (2 Mo maximum).' });
      return;
    }

    setEnvoiPhoto(true);
    try {
      const { user } = await api.envoyerPhoto(fichier);
      mettreAJourUtilisateur(user);
      setMessagePhoto({ type: 'succes', texte: 'Photo de profil mise à jour.' });
    } catch (err) {
      setMessagePhoto({ type: 'erreur', texte: err.message });
    } finally {
      setEnvoiPhoto(false);
    }
  }

  async function retirerPhoto() {
    setMessagePhoto(null);
    setEnvoiPhoto(true);
    try {
      const { user } = await api.supprimerPhoto();
      mettreAJourUtilisateur(user);
      setMessagePhoto({ type: 'succes', texte: 'Photo de profil retirée.' });
    } catch (err) {
      setMessagePhoto({ type: 'erreur', texte: err.message });
    } finally {
      setEnvoiPhoto(false);
    }
  }

  function modifier(champ) {
    return (e) => setMotsDePasse((m) => ({ ...m, [champ]: e.target.value }));
  }

  async function changerMotDePasse(e) {
    e.preventDefault();
    setMessage(null);

    if (motsDePasse.nouveau.length < LONGUEUR_MIN) {
      setMessage({ type: 'erreur', texte: `Le nouveau mot de passe doit contenir au moins ${LONGUEUR_MIN} caractères.` });
      return;
    }
    if (motsDePasse.nouveau !== motsDePasse.confirmation) {
      setMessage({ type: 'erreur', texte: 'Les nouveaux mots de passe ne correspondent pas.' });
      return;
    }
    if (motsDePasse.nouveau === motsDePasse.actuel) {
      setMessage({ type: 'erreur', texte: "Le nouveau mot de passe doit être différent de l'ancien." });
      return;
    }

    setEnCours(true);
    try {
      await api.changerMotDePasse(motsDePasse.actuel, motsDePasse.nouveau);
      setMotsDePasse(MOTS_DE_PASSE_VIDES);
      setMessage({ type: 'succes', texte: 'Mot de passe mis à jour.' });
    } catch (err) {
      setMessage({ type: 'erreur', texte: err.message });
    } finally {
      setEnCours(false);
    }
  }

  return (
    <>
      <header className="entete-profil">
        <h1><IconeUtilisateur taille={22} /> Mon profil</h1>
        <p>Vos informations d'agent et la sécurité de votre compte</p>
      </header>

      <div className="page">
        {erreurProfil && <p className="profil-message erreur" role="alert">{erreurProfil}</p>}

        <div className="profil-grille">
          <section className="carte profil-carte">
            <h2 className="profil-carte-titre">Informations personnelles</h2>
            <div className="profil-carte-corps">
              <div className="profil-identite">
                <Avatar utilisateur={utilisateur} className="profil-avatar" />
                <div className="profil-identite-texte">
                  <strong>{prenom} {nom}</strong>
                  <span>{LIBELLES_GRADE[utilisateur.grade] ?? utilisateur.grade}</span>
                  <div className="profil-photo-actions">
                    <input
                      ref={champPhoto}
                      type="file"
                      accept={TYPES_PHOTO.join(',')}
                      hidden
                      onChange={changerPhoto}
                    />
                    <button
                      type="button"
                      className="profil-bouton-secondaire"
                      onClick={() => champPhoto.current?.click()}
                      disabled={envoiPhoto}
                    >
                      <IconeAppareilPhoto taille={15} />
                      {envoiPhoto ? 'Envoi…' : 'Changer la photo'}
                    </button>
                    {utilisateur.avatar_url && (
                      <button
                        type="button"
                        className="profil-bouton-lien"
                        onClick={retirerPhoto}
                        disabled={envoiPhoto}
                      >
                        Retirer
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {messagePhoto && (
                <p className={`profil-message ${messagePhoto.type}`} role={messagePhoto.type === 'erreur' ? 'alert' : 'status'}>
                  {messagePhoto.texte}
                </p>
              )}

              <dl className="profil-champs">
                <div className="profil-champ">
                  <dt>Matricule</dt>
                  <dd className="mono">{utilisateur.badge_number}</dd>
                </div>
                <div className="profil-champ">
                  <dt>Rôle</dt>
                  <dd><span className={`profil-role ${role ?? ''}`}>{LIBELLES_ROLE[role] ?? utilisateur.role}</span></dd>
                </div>
                <div className="profil-champ complet">
                  <dt>Adresse courriel</dt>
                  <dd className="avec-icone"><IconeCourriel taille={16} /> {utilisateur.email ?? '—'}</dd>
                </div>
                <div className="profil-champ complet">
                  <dt>Membre depuis</dt>
                  <dd className="avec-icone"><IconeCalendrier taille={16} /> {formaterDate(utilisateur.created_at)}</dd>
                </div>
              </dl>
              <p className="profil-note">
                Pour modifier ces informations, adressez-vous à votre superviseur.
              </p>
            </div>
          </section>

          <section className="carte profil-carte">
            <h2 className="profil-carte-titre">Sécurité du compte</h2>
            <form className="profil-carte-corps profil-formulaire" onSubmit={changerMotDePasse}>
              <p className="profil-note">
                <IconeCadenas taille={14} /> Au moins {LONGUEUR_MIN} caractères. Votre session reste active après le changement.
              </p>

              <div className="champ-profil">
                <label htmlFor="mdp-actuel">Mot de passe actuel</label>
                <input
                  id="mdp-actuel"
                  type="password"
                  value={motsDePasse.actuel}
                  onChange={modifier('actuel')}
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="champ-profil">
                <label htmlFor="mdp-nouveau">Nouveau mot de passe</label>
                <input
                  id="mdp-nouveau"
                  type="password"
                  value={motsDePasse.nouveau}
                  onChange={modifier('nouveau')}
                  autoComplete="new-password"
                  minLength={LONGUEUR_MIN}
                  required
                />
              </div>
              <div className="champ-profil">
                <label htmlFor="mdp-confirmation">Confirmer le nouveau mot de passe</label>
                <input
                  id="mdp-confirmation"
                  type="password"
                  value={motsDePasse.confirmation}
                  onChange={modifier('confirmation')}
                  autoComplete="new-password"
                  minLength={LONGUEUR_MIN}
                  required
                />
              </div>

              {message && (
                <p className={`profil-message ${message.type}`} role={message.type === 'erreur' ? 'alert' : 'status'}>
                  {message.texte}
                </p>
              )}

              <button type="submit" className="profil-bouton-principal" disabled={enCours}>
                <IconeEnregistrer taille={17} />
                {enCours ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
