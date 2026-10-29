# Marque visuelle

Ce qui est **réellement dans le code** (`frontend/src/styles/app.css` et les autres feuilles). Toute nouvelle valeur passe par une variable de cette liste, ou est ajoutée ici.

## Couleurs

| Variable | Valeur | Rôle |
|---|---|---|
| `--marine-900` | `#0c1a30` | Menu latéral, fenêtre d'appel, textes sur fond clair très forts |
| `--marine-800` | `#13233d` | Surfaces foncées secondaires |
| `--marine-700` | `#1f3a66` | Couleur principale : boutons principaux, mes bulles de messagerie, liens actifs |
| `--marine-600` | `#2a4a7d` | Survol des éléments principaux, contour de focus |
| `--fond` | `#f1f4f8` | Fond de page, survol des lignes |
| `--surface` | `#fbfcfd` | Cartes et panneaux |
| `--bordure` | `#d6dce5` | Traits et contours |
| `--texte` | `#141a24` | Texte principal |
| `--texte-doux` | `#5b6573` | Texte secondaire, légendes |
| `--texte-pale` | `#8a93a0` | Séparateurs de dates, indices |
| `--lien` | `#3a6ab0` | Liens, actions secondaires |
| `--danger` / `--danger-fond` | `#c62828` / `#fde2e2` | **Alerte urgente**, erreurs, non-lus, raccrocher |
| `--succes` / `--succes-fond` | `#2e8b4a` / `#dcf5e3` | Confirmation, en ligne, accepter un appel |

Règles :
- **Le rouge est réservé à l'urgence et à l'erreur.** Jamais décoratif. S'il y a du rouge partout, une vraie alerte ne se voit plus.
- Le vert dit « réussi » ou « en ligne », rien d'autre.
- L'application est **claire** ; le bleu nuit marque la navigation (menu) et les fenêtres flottantes (appel). Pas de thème sombre pour le contenu pour l'instant.

## Typographie

- `--police` : `'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif`.
  ⚠️ **Inter n'est chargée nulle part** (pas de lien Google Fonts ni de fichier) : en pratique, Windows affiche Segoe UI et macOS la police système. Soit on charge Inter, soit on retire son nom. À trancher.
- `--mono` : `'JetBrains Mono', …` (même remarque) pour les matricules et numéros de dossier quand ils doivent s'aligner.
- Tailles courantes : 12 px (légendes), 13–14 px (texte d'interface), 15 px (messages), 16–17 px (titres de carte), titres de page plus grands.
- Chiffres en colonnes : `font-variant-numeric: tabular-nums`.

## Mise en page

- Grille de l'application : **menu latéral de 250 px** (bleu nuit) + contenu sur fond `--fond`.
- Contenu en **cartes** (`.carte`) : fond `--surface`, bordure `--bordure`, rayon `--rayon` (10 px).
- Sous 860 px, les colonnes passent en une seule.
- Espacements par `gap` dans des grilles ou des flex, pas par marges isolées.

## Composants existants

| Composant | Où | Notes |
|---|---|---|
| Bouton principal | `.registre-bouton-principal` | Fond marine 700, texte blanc |
| Bouton icône | `.messagerie-bouton-icone`, `.messagerie-icone` | 40 px, rond au survol |
| Icônes | `composants/Icones.jsx` | SVG au trait, style Lucide, trait de 2, 18–24 px |
| Avatar | `composants/Avatar.jsx` | Photo, sinon initiales sur marine |
| Pastille | `.menu-pastille`, `.messagerie-non-lus` | Rouge, nombre en blanc, « 99+ » |
| Notification | `composants/Notifications.jsx` | En haut à droite ; alerte urgente rouge qui reste, communiqué qui disparaît après 8 s |
| Message d'état | `.registre-message` (`.erreur`, `.succes`) | Au-dessus du contenu concerné |
| Fenêtre de confirmation | `.fenetre-confirmation` | Pour désactiver un compte, retirer un dossier |
| Carte | Leaflet + OpenStreetMap | Repère rond = signalement, carré = dossier |

## Accessibilité (minimum)

- Contraste AA pour tout texte (attention au `--texte-pale` sur `--fond`).
- Tout est utilisable au clavier, avec un contour de focus visible.
- `aria-live="polite"` pour les informations, jamais `assertive` sauf urgence.
- Les animations respectent `prefers-reduced-motion`.
