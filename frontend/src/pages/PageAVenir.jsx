import { Link } from 'react-router-dom';
import '../styles/registre.css';
import '../styles/pages.css';

// Section prévue mais pas encore développée : elle est annoncée comme telle à l'écran
// (et listée dans « Ce qui est simulé » du README)
export default function PageAVenir({ titre, Icone, description, prevu }) {
  return (
    <>
      <header className="entete-registre">
        <div>
          <h1>{titre} <span className="a-venir">À venir</span></h1>
          <p>Cette section n'est pas encore disponible.</p>
        </div>
      </header>

      <div className="page">
        <section className="carte pages-carte pages-a-venir">
          <Icone taille={40} />
          <p>{description}</p>
          <p className="registre-note">{prevu}</p>
          <Link to="/">Retour au tableau de bord</Link>
        </section>
      </div>
    </>
  );
}
