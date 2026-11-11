import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import * as api from '../api.js';
import { IconeCadenas, IconeEnregistrer } from './Icones.jsx';

// Double authentification de l'agent connecté (Mon profil), facultative pour tous les comptes.
// Comme une application bancaire : un code QR à scanner dans Google Authenticator (ou Microsoft
// Authenticator), un premier code pour confirmer, puis 10 codes de secours à garder.
// Le secret n'est montré qu'une fois; le serveur le garde chiffré et vérifie chaque code.
export default function DeuxFacteurs({ utilisateur, mettreAJourUtilisateur }) {
  const compteGithub = utilisateur.badge_number?.startsWith('GH-');
  const [etape, setEtape] = useState('repos'); // repos | qr | secours
  const [preparation, setPreparation] = useState(null); // { secret, adresse }
  const [code, setCode] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [codesSecours, setCodesSecours] = useState([]);
  const [message, setMessage] = useState(null);
  const [enCours, setEnCours] = useState(false);

  async function executer(action) {
    setMessage(null);
    setEnCours(true);
    try {
      await action();
    } catch (err) {
      setMessage({ type: 'erreur', texte: err.message });
    } finally {
      setEnCours(false);
    }
  }

  const commencer = () => executer(async () => {
    setPreparation(await api.preparerDeuxFacteurs());
    setCode('');
    setEtape('qr');
  });

  const activer = (e) => {
    e.preventDefault();
    executer(async () => {
      const reponse = await api.activerDeuxFacteurs(code.trim());
      mettreAJourUtilisateur(reponse.user);
      setCodesSecours(reponse.codesSecours);
      setPreparation(null);
      setCode('');
      setEtape('secours');
    });
  };

  const desactiver = (e) => {
    e.preventDefault();
    executer(async () => {
      const reponse = await api.desactiverDeuxFacteurs(compteGithub ? undefined : motDePasse, code.trim());
      mettreAJourUtilisateur(reponse.user);
      setCode('');
      setMotDePasse('');
      setMessage({ type: 'succes', texte: 'Double authentification désactivée.' });
    });
  };

  async function copierCodes() {
    const texte = `Codes de secours CrimeTracker (${utilisateur.badge_number}) — chacun ne sert qu'une fois :\n${codesSecours.join('\n')}`;
    try {
      await navigator.clipboard.writeText(texte);
      setMessage({ type: 'succes', texte: 'Codes copiés. Gardez-les dans un endroit sûr.' });
    } catch {
      setMessage({ type: 'erreur', texte: 'Copie impossible : notez les codes à la main.' });
    }
  }

  const messageAffiche = message && (
    <p className={`profil-message ${message.type}`} role={message.type === 'erreur' ? 'alert' : 'status'}>
      {message.texte}
    </p>
  );

  return (
    <section className="carte profil-carte" aria-labelledby="titre-deux-facteurs">
      <h2 className="profil-carte-titre" id="titre-deux-facteurs">Double authentification</h2>
      <div className="profil-carte-corps profil-formulaire">
        {etape === 'secours' ? (
          <>
            <p className="profil-message succes" role="status">Double authentification activée.</p>
            <p className="profil-note deux-facteurs-texte">
              <strong>Gardez ces 10 codes de secours dans un endroit sûr.</strong> Si vous perdez votre téléphone,
              chacun permet une connexion, une seule fois. Ils ne seront plus jamais affichés.
            </p>
            <ol className="deux-facteurs-codes">
              {codesSecours.map((c) => <li key={c}><code>{c}</code></li>)}
            </ol>
            {messageAffiche}
            <button type="button" className="profil-bouton-secondaire" onClick={copierCodes}>Copier les codes</button>
            <button type="button" className="profil-bouton-principal" onClick={() => { setEtape('repos'); setMessage(null); }}>
              <IconeEnregistrer taille={17} /> J'ai gardé mes codes
            </button>
          </>
        ) : utilisateur.totp_active ? (
          <form onSubmit={desactiver} className="profil-formulaire">
            <p className="deux-facteurs-etat actif">
              <IconeCadenas taille={14} /> Active : à chaque connexion, le code de votre application est demandé.
            </p>
            <p className="profil-note">Pour la désactiver, confirmez{compteGithub ? '' : ' votre mot de passe et'} un code actuel ou un code de secours.</p>
            {!compteGithub && (
              <div className="champ-profil">
                <label htmlFor="deux-facteurs-mdp">Mot de passe actuel</label>
                <input id="deux-facteurs-mdp" type="password" autoComplete="current-password" value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)} required />
              </div>
            )}
            <div className="champ-profil">
              <label htmlFor="deux-facteurs-code-off">Code de vérification</label>
              <input id="deux-facteurs-code-off" type="text" inputMode="numeric" autoComplete="one-time-code"
                maxLength={20} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            {messageAffiche}
            <button type="submit" className="profil-bouton-lien" disabled={enCours}>
              {enCours ? 'Désactivation…' : 'Désactiver la double authentification'}
            </button>
          </form>
        ) : etape === 'qr' && preparation ? (
          <form onSubmit={activer} className="profil-formulaire">
            <p className="profil-note">
              1. Dans Google Authenticator (ou Microsoft Authenticator), touchez « + », puis scannez ce code QR.
            </p>
            <div className="deux-facteurs-qr">
              <QRCodeSVG value={preparation.adresse} size={176} marginSize={2} title="Code QR de la double authentification" />
            </div>
            <p className="profil-note">Impossible de scanner ? Entrez cette clé à la main :</p>
            <code className="deux-facteurs-cle">{preparation.secret.match(/.{1,4}/g).join(' ')}</code>
            <div className="champ-profil">
              <label htmlFor="deux-facteurs-code">2. Code à 6 chiffres affiché par l'application</label>
              <input id="deux-facteurs-code" type="text" inputMode="numeric" autoComplete="one-time-code"
                maxLength={6} placeholder="000000" value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required />
            </div>
            {messageAffiche}
            <button type="submit" className="profil-bouton-principal" disabled={enCours || code.length !== 6}>
              <IconeCadenas taille={17} /> {enCours ? 'Vérification…' : 'Activer'}
            </button>
            <button type="button" className="profil-bouton-secondaire" onClick={() => { setEtape('repos'); setPreparation(null); setMessage(null); }}>
              Annuler
            </button>
          </form>
        ) : (
          <>
            <p className="deux-facteurs-etat">Inactive.</p>
            <p className="profil-note">
              Protégez votre compte : en plus de {compteGithub ? 'GitHub' : 'votre mot de passe'}, la connexion demandera un code
              à 6 chiffres qui change toutes les 30 secondes dans une application de votre téléphone.
            </p>
            {messageAffiche}
            <button type="button" className="profil-bouton-principal" onClick={commencer} disabled={enCours}>
              <IconeCadenas taille={17} /> {enCours ? 'Préparation…' : 'Activer la double authentification'}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
