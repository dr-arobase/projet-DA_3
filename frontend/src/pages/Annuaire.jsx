import { useEffect, useState } from 'react';
import * as api from '../api.js';
import { useAuth } from '../composants/AuthContext.js';
import { useTempsReel } from '../composants/TempsReelContext.js';
import { IconeRecherche } from '../composants/Icones.jsx';
import { LIBELLES_ROLE, LIBELLES_GRADE, estAuMoins, nomAgent } from '../agents.js';
import '../styles/registre.css';
import '../styles/pages.css';

// Agents connectés en temps réel (#14, présence Socket.IO) pour tous;
// l'annuaire complet (GET /api/users) pour les superviseurs et la direction
export default function Annuaire() {
  const { utilisateur } = useAuth();
  const { presence } = useTempsReel();
  const voitTout = estAuMoins(utilisateur, 'superviseur');

  const [agents, setAgents] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (!voitTout) return;
    api.listerUtilisateurs()
      .then(setAgents)
      .catch((err) => setErreur(err.message));
  }, [voitTout]);

  // Un agent peut avoir plusieurs onglets ouverts : une seule entrée par agent
  const connectes = [...new Map(presence.map((p) => [p.id, p])).values()];
  const enLigne = new Set(connectes.map((p) => p.id));

  const terme = recherche.trim().toLowerCase();
  const filtres = agents
    .filter((a) => a.is_active)
    .filter((a) => !terme || `${nomAgent(a)} ${a.badge_number}`.toLowerCase().includes(terme));

  return (
    <>
      <header className="entete-registre">
        <div>
          <h1>Annuaire</h1>
          <p>{connectes.length} agent{connectes.length > 1 ? 's' : ''} connecté{connectes.length > 1 ? 's' : ''} en ce moment</p>
        </div>
      </header>

      <div className="page pages-colonne">
        <section className="carte pages-carte">
          <h2 className="pages-titre"><span className="pages-point" aria-hidden="true" /> Connectés maintenant</h2>
          {connectes.length === 0 ? (
            <p className="registre-note">Aucun agent connecté.</p>
          ) : (
            <ul className="pages-presence">
              {connectes.map((p) => (
                <li key={p.id}>
                  <strong>{p.badge_number}</strong>
                  <small>{LIBELLES_ROLE[p.role]} · {LIBELLES_GRADE[p.grade]}</small>
                </li>
              ))}
            </ul>
          )}
        </section>

        {voitTout && (
          <section className="pages-colonne">
            <div className="registre-filtres" role="search">
              <label className="registre-recherche">
                <IconeRecherche taille={15} />
                <input
                  type="search"
                  placeholder="Rechercher par nom ou matricule…"
                  aria-label="Rechercher par nom ou matricule"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                />
              </label>
            </div>

            {erreur && <p className="registre-message erreur" role="alert">{erreur}</p>}

            <div className="carte registre-tableau-cadre">
              <table className="registre-tableau pages-tableau-fixe">
                <thead>
                  <tr>
                    <th scope="col">Agent</th>
                    <th scope="col">Rôle et grade</th>
                    <th scope="col">Courriel</th>
                    <th scope="col">Présence</th>
                  </tr>
                </thead>
                <tbody>
                  {filtres.map((a) => (
                    <tr key={a.id}>
                      <td>{nomAgent(a)}<small>{a.badge_number}</small></td>
                      <td>{LIBELLES_ROLE[a.role]}<small>{LIBELLES_GRADE[a.grade]}</small></td>
                      <td><a href={`mailto:${a.email}`}>{a.email}</a></td>
                      <td>
                        {enLigne.has(a.id)
                          ? <span className="statut statut-capture">En ligne</span>
                          : <span className="registre-note">Hors ligne</span>}
                      </td>
                    </tr>
                  ))}
                  {filtres.length === 0 && (
                    <tr className="registre-vide"><td colSpan={4}>Aucun agent ne correspond.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
