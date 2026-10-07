import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../composants/AuthContext.js';
import useDashboardData from '../hooks/useDashboardData.js';
import { estAuMoins } from '../agents.js';
import {
  IconeRecherche, IconeCloche, IconeSirene, IconeAjoutPersonne, IconeCoche, IconeMegaphone,
} from '../composants/Icones.jsx';
import '../styles/home.css';

const ICONES_ACTIVITE = {
  alerte: IconeSirene,
  ajout: IconeAjoutPersonne,
  classee: IconeCoche,
};

export default function Home() {
  const { utilisateur } = useAuth();
  const { erreur, stats, activites, dernierCommunique, notifications } = useDashboardData();
  const navigate = useNavigate();

  // La recherche ouvre le registre filtré sur ce nom
  function rechercher(e) {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get('q').trim();
    navigate(q ? `/personnes-recherchees?q=${encodeURIComponent(q)}` : '/personnes-recherchees');
  }

  return (
    <>
      <header className="entete">
        <div>
          <h1>Tableau de bord</h1>
          <p className="entete-sous-titre">
            Matricule {utilisateur?.badge_number ?? '—'} · Brigade Sécurité Publique
          </p>
        </div>
        <div className="entete-actions">
          <form className="recherche" role="search" onSubmit={rechercher}>
            <IconeRecherche taille={15} />
            <input name="q" type="search" placeholder="Rechercher une fiche…" aria-label="Rechercher une fiche" />
          </form>
          <Link to="/alertes" className="cloche" aria-label={`${notifications} alertes urgentes aujourd'hui`}>
            <IconeCloche taille={17} />
            {notifications > 0 && <span className="cloche-pastille">{notifications}</span>}
          </Link>
        </div>
      </header>

      <div className="page">
        {erreur && <p className="erreur" role="alert">{erreur}</p>}

        <section className="cartes-stats">
          {stats.map((s) => (
            <article key={s.libelle} className="carte carte-stat">
              <strong className={s.ton ? `ton-${s.ton}` : undefined}>{s.valeur}</strong>
              <span>{s.libelle}</span>
            </article>
          ))}
        </section>

        <div className="grille">
          <section>
            <div className="section-titre">
              <h2>Activité récente</h2>
              <Link to="/alertes">Tout voir</Link>
            </div>
            <ul className="carte activites">
              {activites.length === 0 && <li className="activite vide">Aucune activité pour l'instant.</li>}
              {activites.map((a) => {
                const Icone = ICONES_ACTIVITE[a.type] ?? IconeSirene;
                return (
                  <li key={a.id} className="activite">
                    <span className={`activite-icone activite-${a.type}`}><Icone taille={16} /></span>
                    <div>
                      <strong>{a.titre}</strong>
                      <small>{a.auteur} · {a.quand}</small>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <aside>
            <div className="section-titre"><h2>Actions rapides</h2></div>
            <div className="actions">
              <Link to="/personnes-recherchees/nouvelle" className="action action-principale">
                <IconeAjoutPersonne taille={17} /> Nouvelle fiche
              </Link>
              {estAuMoins(utilisateur, 'superviseur') && (
                <>
                  <Link to="/alertes" className="action">
                    <IconeSirene taille={17} /> Diffuser une alerte
                  </Link>
                  <Link to="/communiques" className="action">
                    <IconeMegaphone taille={17} /> Diffuser un communiqué
                  </Link>
                </>
              )}
            </div>

            <div className="section-titre"><h2>Dernier communiqué</h2></div>
            {dernierCommunique ? (
              <article className={`carte communique${dernierCommunique.prioritaire ? ' prioritaire' : ''}`}>
                {dernierCommunique.prioritaire && <span className="etiquette">Prioritaire</span>}
                <strong>{dernierCommunique.titre}</strong>
                <small>{dernierCommunique.auteur} · {dernierCommunique.heure}</small>
              </article>
            ) : (
              <article className="carte communique"><small>Aucun communiqué diffusé.</small></article>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
