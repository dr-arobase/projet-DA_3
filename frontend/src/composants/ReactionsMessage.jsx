import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import SelecteurEmojis from './SelecteurEmojis.jsx';
import { IconeSourire, IconePlus } from './Icones.jsx';

// Réactions rapides, comme dans Messenger : une seule par agent et par message.
// Toucher une autre emoji remplace la sienne, retoucher la même la retire (le serveur décide).
const RAPIDES = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
// Taille à prévoir pour le menu : barre rapide, ou sélecteur complet
const TAILLE_BARRE = { hauteur: 56, largeur: 290 };
const TAILLE_SELECTEUR = { hauteur: 210, largeur: 300 };

// Le fil des messages défile et coupe tout ce qui dépasse. On ouvre donc le menu du côté où il tient :
// vers le haut s'il y a la place (sinon vers le bas, ex. premier message du fil), et vers la droite
// s'il y a la place (sinon vers la gauche, ex. bulle collée au bord sur téléphone).
// Rectangle où le menu peut s'afficher : la zone des messages, coupée par l'écran et par la barre du bas
function zoneVisible(element) {
  const z = (element?.closest('.messagerie-messages') ?? document.documentElement).getBoundingClientRect();
  const nav = document.querySelector('.nav-mobile');
  const navHaut = nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().top : Infinity;
  return {
    haut: Math.max(z.top, 0),
    bas: Math.min(z.bottom, window.innerHeight, navHaut),
    gauche: Math.max(z.left, 0),
    droite: Math.min(z.right, window.innerWidth),
  };
}

function placer(element, { hauteur, largeur }) {
  const b = element.getBoundingClientRect();
  const { haut, bas, gauche, droite } = zoneVisible(element);
  return {
    versLeBas: b.top - haut < hauteur && bas - b.bottom > b.top - haut,
    versLaGauche: droite - b.left < largeur && b.right - gauche > droite - b.left,
  };
}

// Bouton « Réagir » à côté d'une bulle, et sa barre de réactions rapides
export function BoutonReagir({ moi, reactions, utilisateurId, onReagir }) {
  const [ouvert, setOuvert] = useState(false);
  const [tout, setTout] = useState(false);
  const [position, setPosition] = useState({ versLeBas: false, versLaGauche: false });
  const boite = useRef(null);
  const maReaction = reactions?.find((r) => r.user_ids.includes(utilisateurId))?.emoji;

  useEffect(() => {
    if (!ouvert || tout) return undefined;
    const dehors = (e) => { if (!boite.current?.contains(e.target)) setOuvert(false); };
    const echap = (e) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('mousedown', dehors);
    document.addEventListener('keydown', echap);
    return () => {
      document.removeEventListener('mousedown', dehors);
      document.removeEventListener('keydown', echap);
    };
  }, [ouvert, tout]);

  // Si la barre rapide ne tient d'aucun côté (écran très étroit), on la décale juste assez pour qu'elle rentre.
  // (Sur téléphone, le sélecteur complet est une feuille fixe au-dessus de la barre du bas : voir pages.css.)
  useLayoutEffect(() => {
    const barre = boite.current?.querySelector('.reagir-barre');
    if (!ouvert || !barre) return;
    barre.style.translate = '';
    const r = barre.getBoundingClientRect();
    const { gauche, droite } = zoneVisible(boite.current);
    const marge = 4;
    const decalage = r.right > droite - marge ? droite - marge - r.right : (r.left < gauche + marge ? gauche + marge - r.left : 0);
    if (decalage) barre.style.translate = `${Math.round(decalage)}px 0`;
  }, [ouvert, tout, position]);

  function ouvrir(complet) {
    setPosition(placer(boite.current, complet ? TAILLE_SELECTEUR : TAILLE_BARRE));
    setTout(complet);
    setOuvert(true);
  }

  function choisir(emoji) {
    onReagir(emoji);
    setOuvert(false);
    setTout(false);
  }

  return (
    <span className={`reagir${moi ? ' moi' : ''}${ouvert ? ' ouvert' : ''}${position.versLeBas ? ' vers-le-bas' : ''}${position.versLaGauche ? ' vers-la-gauche' : ''}`} ref={boite}>
      <button
        type="button"
        className="reagir-bouton"
        onClick={() => (ouvert ? setOuvert(false) : ouvrir(false))}
        aria-label="Réagir à ce message"
        aria-expanded={ouvert}
        title="Réagir"
      >
        <IconeSourire taille={16} />
      </button>
      {ouvert && !tout && (
        <span className="reagir-barre" role="toolbar" aria-label="Réactions rapides">
          {RAPIDES.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={emoji === maReaction ? 'choisie' : ''}
              aria-pressed={emoji === maReaction}
              aria-label={emoji === maReaction ? `Retirer ${emoji}` : `Réagir avec ${emoji}`}
              onClick={() => choisir(emoji)}
            >
              {emoji}
            </button>
          ))}
          <button type="button" className="reagir-plus" aria-label="Autres emoji" onClick={() => ouvrir(true)}>
            <IconePlus taille={16} />
          </button>
        </span>
      )}
      {ouvert && tout && (
        <span className="reagir-tout">
          <SelecteurEmojis verbe="Réagir avec" onChoisir={choisir} onFermer={() => { setTout(false); setOuvert(false); }} />
        </span>
      )}
    </span>
  );
}

// Pastilles sous la bulle : une par emoji, avec le nombre d'agents. La sienne est surlignée ;
// un clic dessus la retire, un clic sur celle d'un autre la rejoint.
export function PastillesReactions({ reactions, utilisateurId, onReagir, nomDe }) {
  if (!reactions?.length) return null;
  return (
    <span className="reactions" aria-label="Réactions">
      {reactions.map(({ emoji, user_ids: ids }) => {
        const mienne = ids.includes(utilisateurId);
        const noms = ids.map((id) => (id === utilisateurId ? 'vous' : nomDe(id))).filter(Boolean).join(', ');
        return (
          <button
            key={emoji}
            type="button"
            className={`reaction${mienne ? ' mienne' : ''}`}
            aria-pressed={mienne}
            title={noms}
            aria-label={`${emoji} : ${noms || ids.length}. ${mienne ? 'Retirer ma réaction' : `Réagir avec ${emoji}`}`}
            onClick={() => onReagir(emoji)}
          >
            <span aria-hidden="true">{emoji}</span>
            {ids.length > 1 && <span className="reaction-nombre" aria-hidden="true">{ids.length}</span>}
          </button>
        );
      })}
    </span>
  );
}
