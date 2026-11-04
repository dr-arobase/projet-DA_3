import { useCallback, useEffect, useState } from 'react';
import * as api from '../api.js';
import { useEvenement, useTempsReel } from '../composants/TempsReelContext.js';
import { STATUTS, LIBELLES_STATUT } from '../registre.js';
import '../styles/registre.css';
import '../styles/pages.css';

// Statistiques globales (#20), calculées à partir des routes existantes et tenues à jour en temps réel
export default function Statistiques() {
  const { agentsConnectes } = useTempsReel();
  const [parStatut, setParStatut] = useState(null);
  const [alertes, setAlertes] = useState([]);
  const [evolution, setEvolution] = useState([]);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    try {
      // limit=1 : seul le total nous intéresse
      const totaux = await Promise.all(STATUTS.map((s) => api.listerCriminels({ status: s, limit: 1 })));
      const aujourdHui = new Date();
      aujourdHui.setHours(0, 0, 0, 0);
      const { total: urgentesDuJour } = await api.listerAlertes({
        severity: 'urgent', since: aujourdHui.toISOString(), limit: 1,
      });
      setParStatut(Object.fromEntries(STATUTS.map((s, i) => [s, totaux[i].total])));
      setAlertes({ urgentesDuJour });
      const [dossiers, listeAlertes] = await Promise.all([
        api.listerCriminels({ limit: 100 }),
        api.listerAlertes({ limit: 100 }),
      ]);
      const semaines = Array.from({ length: 6 }, (_, index) => {
        const debut = new Date();
        debut.setHours(0, 0, 0, 0);
        debut.setDate(debut.getDate() - (5 - index) * 7 - debut.getDay() + 1);
        const fin = new Date(debut);
        fin.setDate(fin.getDate() + 7);
        const dans = (date) => { const d = new Date(date); return d >= debut && d < fin; };
        return {
          label: debut.toLocaleDateString('fr-CA', { day: '2-digit', month: '2-digit' }),
          ajoutes: dossiers.data.filter((d) => dans(d.added_at)).length,
          captures: dossiers.data.filter((d) => d.status === 'capture' && dans(d.updated_at)).length,
          alertes: listeAlertes.data.filter((a) => dans(a.created_at)).length,
        };
      });
      setEvolution(semaines);
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
  const duJour = alertes.urgentesDuJour ?? 0;

  const tuiles = [
    { valeur: total, libelle: 'Dossiers au registre' },
    { valeur: `${tauxCapture} %`, libelle: 'Taux de capture' },
    { valeur: duJour, libelle: "Alertes urgentes aujourd'hui", ton: 'danger' },
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
          <h2 className="pages-titre">Évolution hebdomadaire</h2>
          <div className="evolution" role="img" aria-label="Évolution des dossiers et alertes par semaine">
            {evolution.map((semaine) => (
              <div className="evolution-semaine" key={semaine.label}>
                <div className="evolution-barres">
                  <span className="evolution-barre ajoutes" style={{ height: `${Math.max(4, semaine.ajoutes * 12)}px` }} title={`${semaine.ajoutes} dossiers ajoutés`} />
                  <span className="evolution-barre captures" style={{ height: `${Math.max(4, semaine.captures * 12)}px` }} title={`${semaine.captures} dossiers capturés`} />
                  <span className="evolution-barre alertes" style={{ height: `${Math.max(4, semaine.alertes * 12)}px` }} title={`${semaine.alertes} alertes`} />
                </div>
                <small>{semaine.label}</small>
              </div>
            ))}
          </div>
          <p className="registre-note">Barres : ajoutés, capturés, alertes. Les dates indiquent le début de la semaine.</p>
        </section>

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
            Les alertes urgentes du jour sont calculées côté serveur : {duJour}.
          </p>
        </section>
      </div>
    </>
  );
}
