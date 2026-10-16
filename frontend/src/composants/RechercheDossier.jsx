import { useEffect, useId, useRef, useState } from 'react';
import * as api from '../api.js';
import { LIBELLES_STATUT } from '../registre.js';

const DELAI_FRAPPE = 250; // ms : on attend que l'agent ait fini de taper avant d'interroger l'API
const MAX_RESULTATS = 8;

const libelle = (d) => `${d.first_name} ${d.last_name} · n° ${d.id} · ${LIBELLES_STATUT[d.status] ?? d.status}`;

// Choisir un dossier en tapant son nom ou son numéro (#66), au lieu d'une longue liste déroulante.
// La recherche passe par l'API : elle trouve aussi les dossiers au-delà des 100 premiers.
// valeur : le dossier choisi (ou null); onChange(dossier | null)
export default function RechercheDossier({ id, valeur, onChange }) {
  const listeId = useId();
  const [terme, setTerme] = useState('');
  const [resultats, setResultats] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(0);
  const [chargement, setChargement] = useState(false);
  const derniereDemande = useRef(0);

  useEffect(() => {
    const t = terme.trim().replace(/^#|^n°\s*/i, '');
    if (!t) {
      setResultats([]);
      return undefined;
    }
    const demande = ++derniereDemande.current;
    const minuterie = setTimeout(() => {
      setChargement(true);
      // Un nombre : le dossier qui porte ce numéro; sinon une recherche par prénom et nom
      const recherche = /^\d+$/.test(t)
        ? api.lireCriminel(t).then((d) => [d]).catch(() => [])
        : api.listerCriminels({ q: t, limit: MAX_RESULTATS }).then(({ data }) => data);
      recherche
        .then((liste) => {
          // Une réponse lente d'une frappe précédente ne remplace pas la plus récente
          if (demande !== derniereDemande.current) return;
          setResultats(liste);
          setActif(0);
        })
        .catch(() => demande === derniereDemande.current && setResultats([]))
        .finally(() => demande === derniereDemande.current && setChargement(false));
    }, DELAI_FRAPPE);
    return () => clearTimeout(minuterie);
  }, [terme]);

  function choisir(dossier) {
    onChange(dossier);
    setTerme('');
    setOuvert(false);
  }

  function auClavier(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOuvert(true);
      setActif((i) => Math.min(i + 1, resultats.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActif((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && ouvert && resultats[actif]) {
      e.preventDefault();
      choisir(resultats[actif]);
    } else if (e.key === 'Escape') {
      setOuvert(false);
    }
  }

  if (valeur) {
    return (
      <div className="recherche-dossier-choisi">
        <span>{libelle(valeur)}</span>
        <button type="button" className="registre-lien" onClick={() => onChange(null)}>Changer</button>
      </div>
    );
  }

  const montrer = ouvert && terme.trim() !== '';
  return (
    <div className="recherche-dossier">
      <input
        id={id}
        type="search"
        role="combobox"
        autoComplete="off"
        placeholder="Nom, prénom ou n° du dossier…"
        aria-expanded={montrer}
        aria-controls={listeId}
        aria-autocomplete="list"
        aria-activedescendant={montrer && resultats[actif] ? `${listeId}-${resultats[actif].id}` : undefined}
        value={terme}
        onChange={(e) => {
          setTerme(e.target.value);
          setOuvert(true);
        }}
        onFocus={() => setOuvert(true)}
        onBlur={() => setTimeout(() => setOuvert(false), 150)}
        onKeyDown={auClavier}
      />
      {montrer && (
        <ul id={listeId} className="carte recherche-dossier-liste" role="listbox">
          {resultats.map((d, i) => (
            <li
              key={d.id}
              id={`${listeId}-${d.id}`}
              role="option"
              aria-selected={i === actif}
              className={i === actif ? 'actif' : undefined}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choisir(d)}
              onMouseEnter={() => setActif(i)}
            >
              {libelle(d)}
            </li>
          ))}
          {resultats.length === 0 && (
            <li className="registre-note" role="presentation">{chargement ? 'Recherche…' : 'Aucun dossier.'}</li>
          )}
        </ul>
      )}
    </div>
  );
}
