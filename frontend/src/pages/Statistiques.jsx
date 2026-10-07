import { useCallback, useEffect, useState } from 'react';
import * as api from '../api.js';
import { useEvenement, useTempsReel } from '../composants/TempsReelContext.js';
import { STATUTS, LIBELLES_STATUT } from '../registre.js';
import '../styles/registre.css';
import '../styles/pages.css';

const estAujourdhui = (date) => new Date(date).toDateString() === new Date().toDateString();

// Statistiques globales (#20), calculées à partir des routes existantes et tenues à jour en temps réel
export default function Statistiques() {
  const { agentsConnectes } = useTempsReel();
  const [parStatut, setParStatut] = useState(null);
  const [alertes, setAlertes] = useState([]);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    try {
      // limit=1 : seul le total nous intéresse
      const totaux = await Promise.all(STATUTS.map((s) => api.listerCriminels({ status: s, limit: 1 })));
      const { data } = await api.listerAlertes({ limit: 100 });
      setParStatut(Object.fromEntries(STATUTS.map((s, i) => [s, totaux[i].total])));
      setAlertes(data);
      setErreur('');
    } catch (err) {
      setErreur(err.message);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  useEvenement('criminal:added', charger);
  useEvenement('criminal:updated', charger);
  useEvenement('criminal:removed', charger);
  useEvenement('alert:broadcast', charger);

  const total = parStatut ? STATUTS.reduce((somme, s) => somme + parStatut[s], 0) : 0;
  const tauxCapture = total ? Math.round((parStatut.capture / total) * 100) : 0;
  const duJour = alertes.filter((a) => estAujourdhui(a.created_at));

  const tuiles = [
    { valeur: total, libelle: 'Dossiers au registre' },
    { valeur: `${tauxCapture} %`, libelle: 'Taux de capture' },
    { valeur: duJour.filter((a) => a.severity === 'urgent').length, libelle: "Alertes urgentes aujourd'hui", ton: 'danger' },
    { valeur: agentsConnectes, libelle: 'Agents connectés', ton: 'succes' },
  ];

  return (
    <>
      <header className="entete-registre">
        <div>
          <h1>Statistiques</h1>
          <p>Mises à jour en direct à chaque changement dans le registre</p>
        </div>
      </header>

      <div className="page pages-colonne">
        {erreur && <p className="registre-message erreur" role="alert">{erreur}</p>}

        <div className="pages-tuiles">
          {tuiles.map((t) => (
            <div key={t.libelle} className={`carte pages-tuile${t.ton ? ` ${t.ton}` : ''}`}>
              <strong>{parStatut ? t.valeur : '…'}</strong>
              <span>{t.libelle}</span>
            </div>
          ))}
        </div>

        <section className="carte pages-carte">
          <h2 className="pages-titre">Dossiers par statut</h2>
          {parStatut && (
            <ul className="pages-barres">
              {STATUTS.map((s) => {
                const part = total ? Math.round((parStatut[s] / total) * 100) : 0;
                return (
                  <li key={s}>
                    <span className="pages-barre-libelle">{LIBELLES_STATUT[s]}</span>
                    <span className="pages-barre-piste" aria-hidden="true">
                      <span className={`pages-barre statut-${s}`} style={{ width: `${part}%` }} />
                    </span>
                    <span className="pages-barre-valeur">{parStatut[s]} ({part} %)</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="carte pages-carte">
          <h2 className="pages-titre">Diffusions</h2>
          <p className="registre-note">
            {alertes.filter((a) => a.severity === 'urgent').length} alerte(s) urgente(s) et{' '}
            {alertes.filter((a) => a.severity === 'info').length} communiqué(s) parmi les 100 dernières diffusions,
            dont {duJour.length} aujourd'hui.
          </p>
        </section>
      </div>
    </>
  );
}
