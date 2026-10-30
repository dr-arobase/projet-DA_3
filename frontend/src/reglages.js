// Préférences d'affichage propres à ce navigateur (menu réduit, section repliée…).
// Le stockage peut être bloqué (navigation privée) : on retombe alors sur la valeur par défaut.
const PREFIXE = 'crimetracker:';

export function lireReglage(cle, defaut) {
  try {
    const valeur = localStorage.getItem(PREFIXE + cle);
    return valeur === null ? defaut : JSON.parse(valeur);
  } catch {
    return defaut;
  }
}

export function ecrireReglage(cle, valeur) {
  try {
    localStorage.setItem(PREFIXE + cle, JSON.stringify(valeur));
  } catch {
    // préférence perdue au prochain chargement, sans gravité
  }
}
