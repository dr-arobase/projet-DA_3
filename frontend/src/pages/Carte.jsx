import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as api from '../api.js';
import { useEvenement } from '../composants/TempsReelContext.js';
import { IconeRepere } from '../composants/Icones.jsx';
import { LIBELLES_STATUT, formaterDate } from '../registre.js';
import '../styles/registre.css';
import '../styles/pages.css';

const MONTREAL = [45.5089, -73.5617];
const COULEURS = { recherche: '#c62828', capture: '#2e8b4a', libere: '#2a4a7d' };
const echapper = (texte) => String(texte ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const VIDE = { criminal_id: '', location: '', notes: '' };

// Carte des signalements terrain (#21) : les derniers signalements, en temps réel;
// un clic sur la carte place un nouveau signalement (#13)
export default function Carte() {
  const conteneur = useRef(null);
  const carte = useRef(null);
  const calque = useRef(null);
  const repereNouveau = useRef(null);

  const [signalements, setSignalements] = useState([]);
  const [dossiers, setDossiers] = useState([]);
  const [position, setPosition] = useState(null);
  const [champs, setChamps] = useState(VIDE);
  const [message, setMessage] = useState({ type: '', texte: '' });
  const [enCours, setEnCours] = useState(false);

  // Création de la carte, une seule fois (Leaflet manipule le DOM lui-même)
  useEffect(() => {
    const instance = L.map(conteneur.current).setView(MONTREAL, 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(instance);
    calque.current = L.layerGroup().addTo(instance);
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

  // Un signalement fait par un autre agent apparaît sans recharger
  useEvenement('sighting:added', useCallback((s) => {
    setSignalements((enCours) => [s, ...enCours.filter((x) => x.id !== s.id)]);
  }, []));

  // Les repères suivent la liste des signalements
  useEffect(() => {
    if (!calque.current) return;
    calque.current.clearLayers();
    for (const s of signalements) {
      if (s.latitude === null || s.longitude === null) continue;
      L.circleMarker([s.latitude, s.longitude], {
        radius: 9, weight: 2, color: '#fff', fillColor: COULEURS[s.criminal_status] ?? '#5b6573', fillOpacity: 0.9,
      })
        .bindPopup(
          `<strong>${echapper(s.criminal_name)}</strong><br>${echapper(s.location)}`
          + (s.notes ? `<br><em>${echapper(s.notes)}</em>` : '')
          + `<br><small>${echapper(s.reported_by)} · ${echapper(formaterDate(s.reported_at, true))}</small>`
          + `<br><a href="/personnes-recherchees/${Number(s.criminal_id)}">Voir le dossier</a>`,
        )
        .addTo(calque.current);
    }
  }, [signalements]);

  // Repère provisoire là où l'agent a cliqué
  useEffect(() => {
    repereNouveau.current?.remove();
    repereNouveau.current = position
      ? L.circleMarker([position.lat, position.lng], { radius: 10, weight: 3, color: '#13233d', fillColor: '#fbfcfd', fillOpacity: 1 })
        .addTo(carte.current)
      : null;
  }, [position]);

  const centrer = (s) => carte.current?.setView([s.latitude, s.longitude], 16);

  async function soumettre(e) {
    e.preventDefault();
    if (!champs.criminal_id || !champs.location.trim()) {
      setMessage({ type: 'erreur', texte: 'Choisissez un dossier et décrivez le lieu.' });
      return;
    }
    setEnCours(true);
    try {
      const { sighting } = await api.signaler({
        criminal_id: Number(champs.criminal_id),
        location: champs.location.trim(),
        notes: champs.notes.trim() || undefined,
        latitude: position.lat,
        longitude: position.lng,
      });
      setSignalements((enCours) => [sighting, ...enCours.filter((x) => x.id !== sighting.id)]);
      setPosition(null);
      setChamps(VIDE);
      setMessage({ type: 'succes', texte: `Signalement de ${sighting.criminal_name} enregistré.` });
    } catch (err) {
      setMessage({ type: 'erreur', texte: err.message });
    } finally {
      setEnCours(false);
    }
  }

  const modifier = (nom) => (e) => setChamps((c) => ({ ...c, [nom]: e.target.value }));
  const sansPosition = signalements.filter((s) => s.latitude === null || s.longitude === null).length;

  return (
    <>
      <header className="entete-registre">
        <div>
          <h1>Carte</h1>
          <p>Cliquez sur la carte pour signaler une observation à cet endroit</p>
        </div>
      </header>

      <div className="page carte-grille">
        <div className="carte carte-cadre">
          <div ref={conteneur} className="carte-leaflet" />
          <ul className="carte-legende">
            {Object.entries(COULEURS).map(([statut, couleur]) => (
              <li key={statut}><span style={{ background: couleur }} />{LIBELLES_STATUT[statut]}</li>
            ))}
          </ul>
        </div>

        <aside className="pages-colonne">
          {message.texte && (
            <p className={`registre-message ${message.type}`} role={message.type === 'erreur' ? 'alert' : 'status'}>{message.texte}</p>
          )}

          {position ? (
            <form className="carte pages-carte" onSubmit={soumettre} noValidate>
              <h2 className="pages-titre"><IconeRepere taille={18} /> Nouveau signalement</h2>
              <p className="registre-note">Position : {position.lat.toFixed(5)}, {position.lng.toFixed(5)}</p>
              <div className="champ-registre">
                <label htmlFor="s-dossier">Dossier<span className="requis" aria-hidden="true"> *</span></label>
                <select id="s-dossier" className="registre-select" value={champs.criminal_id} onChange={modifier('criminal_id')}>
                  <option value="">Choisir…</option>
                  {dossiers.map((d) => (
                    <option key={d.id} value={d.id}>{d.first_name} {d.last_name} ({LIBELLES_STATUT[d.status]})</option>
                  ))}
                </select>
              </div>
              <div className="champ-registre">
                <label htmlFor="s-lieu">Lieu<span className="requis" aria-hidden="true"> *</span></label>
                <input id="s-lieu" maxLength={255} placeholder="Ex. : sortie du métro Mont-Royal" value={champs.location} onChange={modifier('location')} />
              </div>
              <div className="champ-registre">
                <label htmlFor="s-notes">Notes</label>
                <textarea id="s-notes" rows={3} value={champs.notes} onChange={modifier('notes')} />
              </div>
              <div className="formulaire-actions">
                <button type="button" className="registre-lien" onClick={() => setPosition(null)}>Annuler</button>
                <button type="submit" className="registre-bouton-principal" disabled={enCours}>
                  {enCours ? 'Envoi…' : 'Signaler'}
                </button>
              </div>
            </form>
          ) : (
            <p className="carte pages-carte registre-note">Aucun point choisi : cliquez sur la carte pour placer un signalement.</p>
          )}

          <section className="carte pages-carte">
            <h2 className="pages-titre">Derniers signalements</h2>
            <ul className="carte-liste">
              {signalements.slice(0, 15).map((s) => (
                <li key={s.id}>
                  {s.latitude !== null && s.longitude !== null ? (
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
