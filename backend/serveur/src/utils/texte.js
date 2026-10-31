// Texte reçu d'un formulaire : trim() ne retire pas les caractères invisibles (#94).
// Un message fait seulement d'espaces de largeur nulle (U+200B), de marques de direction
// ou de caractères « blancs » (U+2800, U+3164…) s'affichait comme une bulle vide.
// Les emojis composées (U+200D, U+FE0F) restent valides : elles ont un caractère visible.
const INVISIBLES = /[\p{Cf}\p{Z}\s⠀ㅤᅟᅠﾠ͏]/gu;

// Texte nettoyé (sans espaces aux bouts), ou '' si ce n'est pas du texte
export const texte = (valeur) => (typeof valeur === 'string' ? valeur.trim() : '');

// Vrai si le texte contient au moins un caractère visible
export const estVisible = (valeur) => valeur.replace(INVISIBLES, '').length > 0;
