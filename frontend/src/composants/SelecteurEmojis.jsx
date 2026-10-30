import { useEffect, useRef, useState } from 'react';

// Sélecteur d'émojis de la messagerie (#58) : quelques catégories, un clic insère l'émoji.
// Se ferme avec Échap ou un clic à l'extérieur. Les émojis sont du texte : ils sont enregistrés
// et réaffichés tels quels (la base est en UTF-8).
const CATEGORIES = [
  { nom: 'Visages', emojis: ['😀', '😂', '🙂', '😉', '😊', '😍', '😎', '🤔', '😐', '😮', '😢', '😡', '😴', '🤝', '🙏', '👀'] },
  { nom: 'Gestes', emojis: ['👍', '👎', '👌', '👏', '🙌', '💪', '✌️', '🤞', '👋', '✋', '☝️', '🫡'] },
  { nom: 'Terrain', emojis: ['🚓', '🚨', '👮', '🕵️', '🚔', '📍', '🗺️', '📸', '🔦', '📻', '🧭', '🚧'] },
  { nom: 'Symboles', emojis: ['✅', '❌', '⚠️', '❗', '❓', '🔴', '🟢', '⏰', '🔒', '❤️', '🔥', '💯'] },
];

export default function SelecteurEmojis({ onChoisir, onFermer }) {
  const [categorie, setCategorie] = useState(0);
  const boite = useRef(null);

  useEffect(() => {
    const dehors = (e) => { if (!boite.current?.contains(e.target)) onFermer(); };
    const echap = (e) => { if (e.key === 'Escape') onFermer(); };
    document.addEventListener('mousedown', dehors);
    document.addEventListener('keydown', echap);
    return () => {
      document.removeEventListener('mousedown', dehors);
      document.removeEventListener('keydown', echap);
    };
  }, [onFermer]);

  return (
    <div className="emojis" ref={boite} role="dialog" aria-label="Choisir un émoji">
      <div className="emojis-onglets" role="tablist">
        {CATEGORIES.map((c, i) => (
          <button
            key={c.nom}
            type="button"
            role="tab"
            aria-selected={i === categorie}
            className={i === categorie ? 'actif' : ''}
            onClick={() => setCategorie(i)}
          >
            {c.nom}
          </button>
        ))}
      </div>
      <div className="emojis-grille" role="tabpanel">
        {CATEGORIES[categorie].emojis.map((emoji) => (
          <button key={emoji} type="button" aria-label={`Insérer ${emoji}`} onClick={() => onChoisir(emoji)}>
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
