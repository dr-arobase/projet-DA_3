import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import * as api from '../api.js';
import { useEvenement } from '../composants/TempsReelContext.js';
import { IconeAjoutPersonne, IconeRecherche } from '../composants/Icones.jsx';
import { STATUTS, LIBELLES_STATUT, nomComplet, formaterDate, formaterJour } from '../registre.js';
import '../styles/registre.css';

const PAR_PAGE = 10;
const DELAI_RECHERCHE = 300; // ms : on attend que l'agent ait fini de taper

// Liste paginée du registre (#4), avec recherche par nom et filtre par statut (#9).
// Les critères sont dans l'URL (?q=…&status=…&page=…) : un lien ou un retour arrière les garde.
export default function PersonnesRecherchees() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const q = params.get('q') ?? '';
  const statut = params.get('status') ?? '';
  const page = Math.max(parseInt(params.get('page'), 10) || 1, 1);

  const [saisie, setSaisie] = useState(q);
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);

  // Change un critère dans l'URL ; tout changement de filtre revient à la page 1
  const changer = useCallback((modifs) => {
    setParams((actuels) => {
      const suivants = new URLSearchParams(actuels);
      for (const [cle, valeur] of Object.entries(modifs)) {
        if (valeur === '' || valeur === undefined || (cle === 'page' && valeur === 1)) suivants.delete(cle);
        else suivants.set(cle, String(valeur));
      }
      if (!('page' in modifs)) suivants.delete('page');
      return suivants;
    }, { replace: true });
  }, [setParams]);

  // La recherche part un peu après la dernière touche
  const dernierEnvoi = useRef(q);
  useEffect(() => {
    const texte = saisie.trim();
    if (texte === q) return undefined;
    const minuterie = setTimeout(() => {
      dernierEnvoi.current = texte;
      changer({ q: texte });
    }, DELAI_RECHERCHE);
    return () => clearTimeout(minuterie);
  }, [saisie, q, changer]);

  // Si l'URL change autrement (lien du tableau de bord, retour arrière), le champ suit.
  // On ignore le q qu'on vient d'envoyer nous-mêmes : l'agent a peut-être continué à taper.
  useEffect(() => {
    if (q !== dernierEnvoi.current) {
      dernierEnvoi.current = q;
      setSaisie(q);
    }
  }, [q]);

  const charger = useCallback(async () => {
    try {
      const donnees = await api.listerCriminels({ q, status: statut, page, limit: PAR_PAGE });
      setResultat(donnees);
      setErreur('');
    } catch (err) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }, [q, statut, page]);

  useEffect(() => {
    setChargement(true);
    charger();
  }, [charger]);

  // Temps réel : un ajout, un changement ou un retrait fait par un autre agent rafraîchit la liste
  useEvenement('criminal:added', charger);
  useEvenement('criminal:updated', charger);
  useEvenement('criminal:removed', charger);

  // Après un retrait, la dernière page peut ne plus exister : on recule sur la dernière qui existe
  useEffect(() => {
    if (resultat && resultat.totalPages > 0 && page > resultat.totalPages) changer({ page: resultat.totalPages });
  }, [resultat, page, changer]);

  const dossiers = resultat?.data ?? [];
  const totalPages = resultat?.totalPages ?? 0;
  const filtre = Boolean(q || statut);

  return (
    <>
      <header className="entete-registre">
        <div>
          <h1>Personnes recherchées</h1>
          <p>
            {resultat
              ? `${resultat.total} dossier${resultat.total > 1 ? 's' : ''}${filtre ? ' correspondant aux critères' : ' au registre'}`
              : 'Registre national'}
          </p>
        </div>
        <Link to="/personnes-recherchees/nouvelle" className="registre-bouton-principal">
          <IconeAjoutPersonne taille={17} /> Nouvelle fiche
        </Link>
      </header>

      <div className="page">
        <div className="registre-filtres" role="search">
          <label className="registre-recherche">
            <IconeRecherche taille={15} />
            <input
              type="search"
              placeholder="Rechercher par nom ou prénom…"
              aria-label="Rechercher par nom ou prénom"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
            />
          </label>
          <select
            className="registre-select"
            aria-label="Filtrer par statut"
            value={statut}
            onChange={(e) => changer({ status: e.target.value })}
          >
            <option value="">Tous les statuts</option>
            {STATUTS.map((s) => <option key={s} value={s}>{LIBELLES_STATUT[s]}</option>)}
          </select>
          {filtre && (
            <button type="button" className="registre-lien" onClick={() => { setSaisie(''); changer({ q: '', status: '' }); }}>
              Effacer les filtres
            </button>
          )}
        </div>

        {erreur && <p className="erreur" role="alert">{erreur}</p>}
        {location.state?.retire && (
          <p className="registre-message succes" role="status">
            Le dossier de {location.state.retire} a été retiré du registre.
          </p>
        )}

        <div className="carte registre-tableau-cadre">
          <table className="registre-tableau">
            <thead>
              <tr>
                <th scope="col">Nom</th>
                <th scope="col">Statut</th>
                <th scope="col">Naissance</th>
                <th scope="col">Nationalité</th>
                <th scope="col">Ajouté</th>
              </tr>
            </thead>
            <tbody>
              {dossiers.map((c) => (
                <tr key={c.id} onClick={() => navigate(`/personnes-recherchees/${c.id}`)}>
                  <td>
                    <Link to={`/personnes-recherchees/${c.id}`} onClick={(e) => e.stopPropagation()}>
                      {nomComplet(c)}
                    </Link>
                    {c.crimes && <small>{c.crimes}</small>}
                  </td>
                  <td><span className={`statut statut-${c.status}`}>{LIBELLES_STATUT[c.status] ?? c.status}</span></td>
                  <td>{formaterJour(c.date_of_birth)}</td>
                  <td>{c.nationality || '—'}</td>
                  <td>
                    {formaterDate(c.added_at)}
                    {c.added_by && <small>par {c.added_by}</small>}
                  </td>
                </tr>
              ))}
              {!chargement && dossiers.length === 0 && (
                <tr className="registre-vide">
                  <td colSpan={5}>
                    {filtre ? 'Aucun dossier ne correspond à ces critères.' : 'Le registre est vide.'}
                  </td>
                </tr>
              )}
              {chargement && dossiers.length === 0 && (
                <tr className="registre-vide"><td colSpan={5}>Chargement…</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <nav className="pagination" aria-label="Pagination">
            <button type="button" disabled={page <= 1} onClick={() => changer({ page: page - 1 })}>
              ← Précédente
            </button>
            <span>Page {page} sur {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => changer({ page: page + 1 })}>
              Suivante →
            </button>
          </nav>
        )}
      </div>
    </>
  );
}
