// Icônes SVG au trait (style Lucide) utilisées dans l'interface
const creer = (contenu) =>
  function Icone({ taille = 18, ...props }) {
    return (
      <svg
        width={taille}
        height={taille}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {contenu}
      </svg>
    );
  };

export const IconeBouclier = creer(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>);
export const IconeUtilisateur = creer(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>);
export const IconeCadenas = creer(<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>);
export const IconeChevron = creer(<path d="m9 18 6-6-6-6" />);
export const IconeMaison = creer(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9v12h14V9" /></>);
export const IconeRecherche = creer(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const IconeSirene = creer(<><path d="M7 18v-6a5 5 0 0 1 10 0v6" /><path d="M5 21h14" /><path d="M12 2v2M4.2 5.2l1.4 1.4M19.8 5.2l-1.4 1.4" /></>);
export const IconeMegaphone = creer(<><path d="m3 11 16-6v14L3 13z" /><path d="M7 13v5a2 2 0 0 0 4 0v-3.5" /></>);
export const IconeMessage = creer(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />);
export const IconeRepere = creer(<><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>);
export const IconeStats = creer(<path d="M5 21V10M12 21V4M19 21v-7" />);
export const IconeGroupe = creer(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></>);
export const IconeCloche = creer(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></>);
export const IconeAjoutPersonne = creer(<><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="M19 8v6M16 11h6" /></>);
export const IconeCoche = creer(<path d="M20 6 9 17l-5-5" />);
export const IconeDeconnexion = creer(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>);
