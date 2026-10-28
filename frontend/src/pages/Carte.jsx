import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as api from '../api.js';
import { useEvenement } from '../composants/TempsReelContext.js';
import { IconeRepere } from '../composants/Icones.jsx';
import RechercheDossier from '../composants/RechercheDossier.jsx';
import { lienPage } from '../config.js';
import { LIBELLES_STATUT, formaterDate } from '../registre.js';
import '../styles/registre.css';
import '../styles/pages.css';

const MONTREAL = [45.5089, -73.5617];
const COULEURS = { recherche: '#c62828', capture: '#2e8b4a', libere: '#2a4a7d' };
const echapper = (texte) => String(texte ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const VIDE = { location: '', notes: '' };
const aUnePosition = (x) => x.latitude !== null && x.latitude !== undefined && x.longitude !== null && x.longitude !== undefined;

// Repère carré d'un dossier (dernière adresse connue, #64), distinct des ronds des signalements
const iconeDossier = (statut) => L.divIcon({
  className: 'carte-repere-dossier',
  html: `<span style="background:${COULEURS[statut] ?? '#5b6573'}"></span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -8],
});

// Carte des signalements terrain (#21) et des dernières adresses connues des dossiers (#64).
// Un signalement se place d'un clic sur la carte, ou en écrivant son adresse (#65).
// ?dossier=<id> centre la carte sur l'adresse de ce dossier.
export default function Carte() {
  const [params] = useSearchParams();
  const dossierVise = Number(params.get('dossier')) || null;

  const conteneur = useRef(null);
  const carte = useRef(null);
  const calqueSignalements = useRef(null);
  const calqueDossiers = useRef(null);
  const reperesDossiers = useRef(new Map());
  const repereNouveau = useRef(null);

  const [signalements, setSignalements] = useState([]);
  const [dossiers, setDossiers] = useState([]);
  const [position, setPosition] = useState(null);
  const [dossier, setDossier] = useState(null);
  const [champs, setChamps] = useState(VIDE);
  const [message, setMessage] = useState({ type: '', texte: '' });
  const [enCours, setEnCours] = useState(false);
  const [localisation, setLocalisation] = useState(false);
  const [aOuvrir, setAOuvrir] = useState(null); // dossier dont on ouvre la bulle une fois son repère posé

  // Création de la carte, une seule fois (Leaflet manipule le DOM lui-même)
  useEffect(() => {
    const instance = L.map(conteneur.current).setView(MONTREAL, 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(instance);
    calqueDossiers.current = L.layerGroup().addTo(instance);
    calqueSignalements.current = L.layerGroup().addTo(instance);
    instance.on('click', (e) => setPosition({ lat: e.latlng.lat, lng: e.latlng.lng }));
    carte.current = instance;
    return () => instance.remove();
  }, []);

  useEffect(() => {
    api.listerSignalementsRecents({ limit: 200 })
      .then(setSignalements)
      .catch((err) => setMessage({ type: 'erreur', texte: err.message }));
    api.listerCriminels({ limit: 100 })
      .then(({ data }) => setDossiers(data))
      .catch(() => {});
  }, []);

  // Temps réel : signalements des autres agents, et dossiers ajoutés, modifiés ou retirés
  useEvenement('sighting:added', useCallback((s) => {
    setSignalements((enCours) => [s, ...enCours.filter((x) => x.id !== s.id)]);
  }, []));
  const majDossier = useCallback((d) => {
    setDossiers((enCours) => [d, ...enCours.filter((x) => x.id !== d.id)]);
  }, []);
  useEvenement('criminal:added', majDossier);
  useEvenement('criminal:updated', majDossier);
  useEvenement('criminal:removed', useCallback(({ id }) => {
    setDossiers((enCours) => enCours.filter((x) => x.id !== id));
  }, []));

  // Les repères suivent la liste des signalements
  useEffect(() => {
    if (!calqueSignalements.current) return;
    calqueSignalements.current.clearLayers();
    for (const s of signalements) {
      if (!aUnePosition(s)) continue;
      L.circleMarker([s.latitude, s.longitude], {
        radius: 9, weight: 2, color: '#fff', fillColor: COULEURS[s.criminal_status] ?? '#5b6573', fillOpacity: 0.9,
      })
        .bindPopup(
          `<strong>${echapper(s.criminal_name)}</strong><br>${echapper(s.location)}`
          + (s.notes ? `<br><em>${echapper(s.notes)}</em>` : '')
          + `<br><small>${echapper(s.reported_by)} · ${echapper(formaterDate(s.reported_at, true))}</small>`
          + `<br><a href="${lienPage(`/personnes-recherchees/${Number(s.criminal_id)}`)}">Voir le dossier</a>`,
        )
        .addTo(calqueSignalements.current);
    }
  }, [signalements]);

  // Repères des dossiers qui ont une adresse placée
  useEffect(() => {
    if (!calqueDossiers.current) return;
    calqueDossiers.current.clearLayers();
    reperesDossiers.current.clear();
    for (const d of dossiers) {
      if (!aUnePosition(d)) continue;
      const repere = L.marker([d.latitude, d.longitude], { icon: iconeDossier(d.status), title: `${d.first_name} ${d.last_name}` })
        .bindPopup(
          `<strong>${echapper(d.first_name)} ${echapper(d.last_name)}</strong>`
          + `<br><small>Dernière adresse connue · ${echapper(LIBELLES_STATUT[d.status])}</small>`
          + `<br>${echapper(d.last_known_address)}`
          + `<br><a href="${lienPage(`/personnes-recherchees/${Number(d.id)}`)}">Voir le dossier</a>`,
        )
        .addTo(calqueDossiers.current);
      reperesDossiers.current.set(d.id, repere);
    }
    if (aOuvrir && reperesDossiers.current.has(aOuvrir)) {
      reperesDossiers.current.get(aOuvrir).openPopup();
      setAOuvrir(null);
    }
  }, [dossiers, aOuvrir]);

  // ?dossier=<id> (lien « Voir sur la carte » de la fiche) : on centre sur son adresse.
  // Il est relu à part : il n'est peut-être pas parmi les 100 derniers dossiers chargés.
  useEffect(() => {
    if (!dossierVise) return;
    api.lireCriminel(dossierVise)
      .then((d) => {
        majDossier(d);
        if (!aUnePosition(d)) return;
        carte.current?.setView([d.latitude, d.longitude], 16);
        setAOuvrir(d.id);
      })
      .catch(() => {});
  }, [dossierVise, majDossier]);

  // Repère provisoire du nouveau signalement
  useEffect(() => {
    repereNouveau.current?.remove();
    repereNouveau.current = position
      ? L.circleMarker([position.lat, position.lng], { radius: 10, weight: 3, color: '#13233d', fillColor: '#fbfcfd', fillOpacity: 1 })
        .addTo(carte.current)
      : null;
  }, [position]);

  const centrer = (x) => carte.current?.setView([x.latitude, x.longitude], 16);

  // Adresse écrite -> position, et la carte s'y déplace
  async function placerAdresse() {
    const adresse = champs.location.trim();
    if (adresse.length < 3) {
      setMessage({ type: 'erreur', texte: 'Écrivez une adresse (rue et ville) pour la placer sur la carte.' });
      return;
    }
    setLocalisation(true);
    setMessage({ type: '', texte: '' });
    try {
      const p = await api.localiser(adresse);
      setPosition({ lat: p.latitude, lng: p.longitude });
      carte.current?.setView([p.latitude, p.longitude], 16);
    } catch (err) {
      setMessage({ type: 'erreur', texte: err.message });
    } finally {
      setLocalisation(false);
    }
  }

  async function soumettre(e) {
    e.preventDefault();
    if (!dossier || !champs.location.trim()) {
      setMessage({ type: 'erreur', texte: 'Choisissez un dossier et décrivez le lieu.' });
      return;
    }
    setEnCours(true);
    try {
      const { sighting } = await api.signaler({
        criminal_id: dossier.id,
        location: champs.location.trim(),
        notes: champs.notes.trim() || undefined,
        // Sans position, le signalement est gardé avec le lieu écrit seulement
        ...(position && { latitude: position.lat, longitude: position.lng }),
      });
      setSignalements((enCours) => [sighting, ...enCours.filter((x) => x.id !== sighting.id)]);
      setPosition(null);
      setDossier(null);
      setChamps(VIDE);
      setMessage({ type: 'succes', texte: `Signalement de ${sighting.criminal_name} enregistré.` });
    } catch (err) {
      setMessage({ type: 'erreur', texte: err.message });
    } finally {
      setEnCours(false);
    }
  }

  function annuler() {
    setPosition(null);
    setDossier(null);
    setChamps(VIDE);
    setMessage({ type: '', texte: '' });
  }

  const modifier = (nom) => (e) => setChamps((c) => ({ ...c, [nom]: e.target.value }));
  const sansPosition = signalements.filter((s) => !aUnePosition(s)).length;

  return (
    <>
      <header className="entete-registre">
        <div>
          <h1>Carte</h1>
          <p>Signalez une observation d'un clic sur la carte, ou en écrivant son adresse</p>
        </div>
      </header>

      <div className="page carte-grille">
        <div className="carte carte-cadre">
          <div ref={conteneur} className="carte-leaflet" />
          <ul className="carte-legende">
            {Object.entries(COULEURS).map(([statut, couleur]) => (
              <li key={statut}><span style={{ background: couleur }} />{LIBELLES_STATUT[statut]}</li>
            ))}
            <li><span className="carte-legende-signalement" />Signalement</li>
            <li><span className="carte-legende-dossier" />Dernière adresse connue</li>
          </ul>
        </div>

        <aside className="pages-colonne">
          {message.texte && (
            <p className={`registre-message ${message.type}`} role={message.type === 'erreur' ? 'alert' : 'status'}>{message.texte}</p>
          )}

          <form className="carte pages-carte" onSubmit={soumettre} noValidate>
            <h2 className="pages-titre"><IconeRepere taille={18} /> Nouveau signalement</h2>
            <div className="champ-registre">
              <label htmlFor="s-dossier">Dossier<span className="requis" aria-hidden="true"> *</span></label>
              <RechercheDossier id="s-dossier" valeur={dossier} onChange={setDossier} />
            </div>
            <div className="champ-registre">
              <label htmlFor="s-lieu">Lieu ou adresse<span className="requis" aria-hidden="true"> *</span></label>
              <div className="carte-adresse">
                <input
                  id="s-lieu"
                  maxLength={255}
                  placeholder="Ex. : 3800 rue Sherbrooke Est, Montréal"
                  value={champs.location}
                  onChange={modifier('location')}
                />
                <button type="button" className="registre-lien" onClick={placerAdresse} disabled={localisation}>
                  {localisation ? 'Recherche…' : 'Placer sur la carte'}
                </button>
              </div>
            </div>
            <p className="registre-note">
              {position
                ? `Position : ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`
                : 'Pas encore de position : cliquez sur la carte ou placez l\'adresse. Sans position, le lieu écrit est gardé seul.'}
            </p>
            <div className="champ-registre">
              <label htmlFor="s-notes">Notes</label>
              <textarea id="s-notes" rows={3} value={champs.notes} onChange={modifier('notes')} />
            </div>
            <div className="formulaire-actions">
              <button type="button" className="registre-lien" onClick={annuler}>Effacer</button>
              <button type="submit" className="registre-bouton-principal" disabled={enCours}>
                {enCours ? 'Envoi…' : 'Signaler'}
              </button>
            </div>
          </form>

          <section className="carte pages-carte">
            <h2 className="pages-titre">Derniers signalements</h2>
            <ul className="carte-liste">
              {signalements.slice(0, 15).map((s) => (
                <li key={s.id}>
                  {aUnePosition(s) ? (
                    <button type="button" className="registre-lien" onClick={() => centrer(s)}>{s.criminal_name}</button>
                  ) : (
                    <strong>{s.criminal_name}</strong>
                  )}
                  <small>{s.location} · {formaterDate(s.reported_at, true)}</small>
                  <Link to={`/personnes-recherchees/${s.criminal_id}`}>Dossier</Link>
                </li>
              ))}
              {signalements.length === 0 && <li className="registre-note">Aucun signalement.</li>}
            </ul>
            {sansPosition > 0 && (
              <p className="registre-note">{sansPosition} signalement(s) sans position ne figure(nt) pas sur la carte.</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
