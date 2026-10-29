# Anti-IA : ce qu'il faut éviter

Les outils d'IA (et les gabarits) tirent vers des écrans propres mais interchangeables. Cette liste dit ce qui ne doit pas apparaître dans CrimeTracker.

## Visuel

- **Thème « cyber police »** : fond noir, néons, vert matrix, radars qui tournent, effets de scan. CrimeTracker est un outil de bureau sobre.
- **Gyrophares et rouge décoratif.** Le rouge est réservé à l'urgence (voir `03-marque-visuelle.md`).
- Dégradés violet-bleu, verre dépoli (glassmorphism), ombres portées sur chaque carte.
- **Tuiles de chiffres géants** en haut de chaque page quand les chiffres ne servent pas à décider.
- Tout centré, grosses bannières d'accueil, illustrations ou photos d'ambiance (menottes, silhouettes, empreintes digitales).
- Émojis comme icônes de section ou de bouton dans l'interface : on utilise les icônes au trait de `Icones.jsx`.
- Coins arrondis identiques partout, barres colorées sur le côté des cartes « pour décorer ».
- Avatars ou photos de vraies personnes, y compris pour les personnes recherchées.

## Texte

- Formules de vente : « Révolutionnez », « en toute simplicité », « Découvrez », « La solution ultime », « Boostez ».
- Ton enjoué : « Super ! », « Oups ! », « C'est parti ! », points d'exclamation.
- Phrases creuses : « N'hésitez pas à… », « Il est important de noter que… ».
- Anglicismes et mots du code dans l'interface : *loading*, *user*, *ID*, *submit*, *dashboard* (on dit *tableau de bord*).
- Messages d'erreur sans action possible (« Une erreur est survenue »).

## Données

- **Faux chiffres présentés comme vrais.** Les chiffres de démonstration de la page de connexion portent l'étiquette « Chiffres de démonstration » ; tout autre chiffre doit venir de l'API.
- Fausse preuve sociale, faux témoignages, faux logos de partenaires (GRC, SPVM, Interpol…).
- *Lorem ipsum* ou « John Doe » : on utilise des noms fictifs plausibles et des matricules au format du projet (`PL-003`, `SM-002`).
- Noms d'organismes réels : la police de CrimeTracker est fictive.

## Comportement

- Une action irréversible sans confirmation (retirer un dossier, désactiver un compte).
- Un bouton visible pour un rôle qui n'a pas le droit de s'en servir.
- Un état périmé affiché sans le dire.
- Une animation qui empêche de lire ou de cliquer, ou qui ignore `prefers-reduced-motion`.
