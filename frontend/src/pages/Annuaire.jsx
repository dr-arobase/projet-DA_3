import { useEffect, useRef, useState } from 'react';
import * as api from '../api.js';
import { useAuth } from '../composants/AuthContext.js';
import { useTempsReel } from '../composants/TempsReelContext.js';
import { IconeRecherche } from '../composants/Icones.jsx';
import { LIBELLES_ROLE, LIBELLES_GRADE, estAuMoins, nomAgent } from '../agents.js';
import '../styles/registre.css';
import '../styles/pages.css';

const PAR_PAGE = 20;

// Agents connectés en temps réel (#14, présence Socket.IO) pour tous;
// l'annuaire complet (GET /api/users) pour les superviseurs et la direction
export default function Annuaire() {
  const { utilisateur } = useAuth();
  const { presence } = useTempsReel();
  const voitTout = estAuMoins(utilisateur, 'superviseur');

  const [agents, setAgents] = useState([]);
  // Noms de tous les agents actifs : la présence Socket.IO ne porte que l'id et le matricule.
  // /api/messages/contacts est ouvert à tout agent, contrairement à /api/users.
  const [noms, setNoms] = useState(new Map());
  const [recherche, setRecherche] = useState('');
  const [page, setPage] = useState(1);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (!voitTout) return;
    api.listerUtilisateurs()
      .then(setAgents)
      .catch((err) => setErreur(err.message));
  }, [voitTout]);

  // Chargés au début, puis rechargés quand un agent jamais vu se connecte (ex. nouveau
  // compte GitHub). Chaque id ne déclenche qu'un rechargement, pour ne jamais boucler.
  const vus = useRef(null);
  useEffect(() => {
    const nouveaux = presence.filter((p) => !vus.current?.has(p.id));
    if (vus.current && nouveaux.length === 0) return;
    vus.current ??= new Set([utilisateur.id]);
    nouveaux.forEach((p) => vus.current.add(p.id));
    api.listerContacts()
      .then((contacts) => setNoms(new Map(contacts.map((c) => [c.id, nomAgent(c)]))))
      .catch(() => {}); // sans les noms, on affiche au moins les matricules
  }, [presence, utilisateur.id]);

  // Nom d'un agent connecté (soi-même n'est pas dans les contacts)
  const nomDe = (p) => (p.id === utilisateur.id ? nomAgent(utilisateur) : noms.get(p.id)) ?? '';

  // Un agent peut avoir plusieurs onglets ouverts : une seule entrée par agent
  const connectes = [...new Map(presence.map((p) => [p.id, p])).values()];
  const enLigne = new Set(connectes.map((p) => p.id));

  const terme = recherche.trim().toLowerCase();
  // Les agents en ligne d'abord : ce sont ceux qu'on peut joindre tout de suite
  const filtres = agents
    .filter((a) => a.is_active)
    .filter((a) => !terme || `${nomAgent(a)} ${a.badge_number}`.toLowerCase().includes(terme))
    .sort((a, b) => Number(enLigne.has(b.id)) - Number(enLigne.has(a.id)));
  const totalPages = Math.max(1, Math.ceil(filtres.length / PAR_PAGE));
  const pageCourante = Math.min(page, totalPages);
  const visibles = filtres.slice((pageCourante - 1) * PAR_PAGE, pageCourante * PAR_PAGE);

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
                  <strong>{nomDe(p) || p.badge_number}</strong>
                  {nomDe(p) && <span className="pages-presence-matricule">{p.badge_number}</span>}
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
                  onChange={(e) => { setRecherche(e.target.value); setPage(1); }}
                />
              </label>
              <span className="utilisateurs-compte" aria-live="polite">{filtres.length} agent{filtres.length > 1 ? 's' : ''} actif{filtres.length > 1 ? 's' : ''}</span>
            </div>

            {erreur && <p className="registre-message erreur" role="alert">{erreur}</p>}

            <div className="carte registre-tableau-cadre">
              <table className="registre-tableau pages-tableau-fixe annuaire-tableau">
                <thead>
                  <tr>
                    <th scope="col">Agent</th>
                    <th scope="col">Rôle et grade</th>
                    <th scope="col">Courriel</th>
                    <th scope="col">Présence</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((a) => (
                    <tr key={a.id}>
                      <td><strong>{nomAgent(a)}</strong><small className="annuaire-matricule">{a.badge_number}</small></td>
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

            {totalPages > 1 && (
              <nav className="pagination" aria-label="Pagination de l'annuaire">
                <button type="button" disabled={pageCourante <= 1} onClick={() => setPage(pageCourante - 1)}>← Précédente</button>
                <span>Page {pageCourante} sur {totalPages}</span>
                <button type="button" disabled={pageCourante >= totalPages} onClick={() => setPage(pageCourante + 1)}>Suivante →</button>
              </nav>
            )}
          </section>
        )}
      </div>
    </>
  );
}
