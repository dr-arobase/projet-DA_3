// Texte reçu d'un formulaire : trim() ne retire pas les caractères invisibles (#94).
// Un message fait seulement d'espaces de largeur nulle (U+200B), de marques de direction
// ou de caractères « blancs » (U+2800, U+3164…) s'affichait comme une bulle vide.
// Les emojis composées (U+200D, U+FE0F) restent valides : elles ont un caractère visible.
// (U+034F, U+115F et U+1160 sont des marques combinantes : hors de la classe, pour ESLint)
const INVISIBLES = /[\p{Cf}\p{Z}\s\u2800\u3164\uFFA0]|\u034F|\u115F|\u1160/gu;

// Texte nettoyé (sans espaces aux bouts), ou '' si ce n'est pas du texte
export const texte = (valeur) => (typeof valeur === 'string' ? valeur.trim() : '');

// Vrai si le texte contient au moins un caractère visible
export const estVisible = (valeur) => valeur.replace(INVISIBLES, '').length > 0;
