# Plan de travail de l'équipe — jusqu'au mercredi 11 novembre 2026

Établi le lundi 2 novembre 2026 par Massyle (Product Owner), après une vérification complète de `main` (dernière version, CI verte, image publiée le 30 octobre). **Toutes les tâches ci-dessous doivent être terminées, revues et fusionnées dans `main` au plus tard le mercredi 11 novembre 2026.**

## Comment utiliser ce document

- Chaque personne a **30 tâches**, classées par gravité. On commence toujours par les plus graves.
- Une tâche est **terminée** quand son critère « Terminé quand » est vrai, qu'elle est dans une PR **revue par un coéquipier** (commentaire concret) et fusionnée, et que la CI est verte. Cochez la case `[x]` dans la PR qui la termine.
- Une PR par tâche (ou par petit groupe de tâches liées), avec `Closes #numéro` quand il y a un ticket.
- **Un ticket ne se ferme que par la PR qui le corrige.** Fermer un ticket sans correction est interdit (voir la section « Ce que la vérification a trouvé »).
- Une question, un blocage : on l'écrit dans le journal du bloc et on prévient le responsable de la mêlée (Eric).

| Gravité | Signification | À finir au plus tard |
|---|---|---|
| **Critique** | Bloque des utilisateurs, ou fait perdre beaucoup de points | mercredi 4 novembre |
| **Élevée** | Faille de sécurité, fonction fausse, ou exigence de l'énoncé manquante | vendredi 6 novembre |
| **Moyenne** | Défaut visible, dette technique, document en retard | lundi 9 novembre |
| **Faible** | Finition, confort, préparation | mercredi 11 novembre |

---

## Ce que la vérification du 2 novembre a trouvé

La vérification a porté sur les trois façons de faire tourner l'application. Elle a été faite comme un utilisateur, fonction par fonction, puis avec 100 agents simulés en même temps.

| Environnement | Ce qui a été vérifié | Résultat |
|---|---|---|
| **Localhost** (`npm`) | Lint, build, tests, audit des dépendances | Lint et build OK, **594 tests sur 594**; audit : 26 vulnérabilités modérées (backend), 5 (frontend), aucune élevée |
| **Docker** (installation neuve, base vide, dernières images de la CI) | 61 parcours fonctionnels + 2 537 vérifications avec 100 agents + 52 écrans (4 tailles) | **55/61** parcours OK; 2 527/2 537 vérifications OK; aucune page qui déborde |
| **Azure** (en ligne, lecture seule) | Pages, API, connexion, GitHub, en-têtes, cookies, serveur | Tout répond en 0,25 s; dernière version; micro et caméra autorisés; cookies `HttpOnly`, `Secure`, `SameSite` |

**Ce qui fonctionne bien** : connexion (mot de passe et GitHub), permissions refusées par le serveur (y compris par le WebSocket), registre, conflit de version (409), carte et géocodage, signalements, alertes et communiqués en direct (100 agents sur 100 en 14 ms), messagerie (texte, modification, suppression, images, faux fichiers refusés, groupes, réactions), appels (en ligne, hors ligne, appel manqué), comptes (création, promotion, désactivation immédiate), profil, Swagger, charge (2 940 requêtes, 95 % en moins de 221 ms).

**Ce qui ne fonctionne pas** (confirmé sur l'installation neuve) :

| Problème | Gravité | Ticket |
|---|---|---|
| En début de quart, **95 agents sur 100** d'un même poste sont refusés à la connexion (429), avec le bon mot de passe; un agent qui se trompe 6 fois bloque ses collègues 15 minutes | Critique | #89 (fermé à tort) |
| **13 tickets fermés le 31 octobre sans aucune correction** dans `main` | Critique | #81, #82, #90, #102, #107, #108, #109, #121, #124, #125, #131 (+ #73, #86 gardés exprès) |
| Session encore valable après la déconnexion (cookie volé réutilisable) | Élevée | #81 |
| Cookie mal formé : erreur 500 | Élevée | #107 |
| Jeton invalide ou expiré : 403 au lieu de 401 | Élevée | #108 |
| Jeton de session renvoyé dans la réponse de connexion | Élevée | #82 |
| Modification complète d'un dossier acceptée **sans version** | Élevée | #98 (PR #168) |
| Signalement avec un lieu vide accepté; alerte faite de caractères invisibles acceptée | Élevée | #94 (PR #170) |
| Journal d'audit : ni la création de compte, ni le changement de statut | Moyenne | #100 (PR #169) |
| La connexion GitHub manque dans `deploy/compose.yml` | Moyenne | #102 |
| JSON mal formé : message brut du parseur, en anglais | Moyenne | #110 |
| Route d'API inconnue : page HTML d'Express | Moyenne | #97 (PR #164) |
| `index.html` sans en-tête de cache | Moyenne | #121 |
| En-têtes `X-Frame-Options` et `nosniff` envoyés deux fois, valeurs contradictoires | Faible | — |
| Recherche : « Bélléfeuille » ne trouve pas « Bellefeuille » | Faible | — |
| Téléphone : le registre et l'annuaire restent des tableaux à faire glisser; petits boutons texte (16 px), repères de la carte (18 px) | Moyenne | — |
| Une ancienne clé JWT est visible dans l'historique Git (`.env.example`); elle n'est utilisée ni sur Azure ni dans nos `.env`, mais elle reste publiée | Faible | — |
| Azure : 887 Mo de mémoire, presque toute utilisée | Moyenne | — |

Les 10 PR ouvertes (#161 à #170) corrigent une partie de ces problèmes : **elles attendent une revue**.

---

## Eric — responsable de la mêlée, sécurité et intégration continue

| # | Gravité | Tâche | Terminé quand | Ticket / fichier | Échéance | Fait |
|---|---|---|---|---|---|---|
| E1 | Critique | Rouvrir les 11 tickets fermés le 31 octobre sans correction, avec un commentaire qui dit ce qui manque | Les 11 tickets sont ouverts et commentés; #73 et #86 restent fermés avec « gardé volontairement pour la démonstration » | #81 #82 #90 #102 #107 #108 #109 #121 #124 #125 #131 | 4 nov. | [ ] |
| E2 | Critique | Corriger la limite de connexion : compter **seulement les échecs**, par adresse IP **et** matricule, avec un plafond par IP beaucoup plus haut | Un test montre que 100 connexions réussies d'une même IP passent, et que 6 échecs sur un matricule ne bloquent pas un collègue | #89 (rouvrir), `login-rate-limit.middleware.js` | 4 nov. | [ ] |
| E3 | Critique | Revoir les PR #161 (message d'erreur du micro) et #162 (relais TURN) | Revue écrite avec au moins un commentaire concret sur chacune, puis fusion ou demande de changement | #161, #162 | 4 nov. | [ ] |
| E4 | Élevée | Jeton invalide ou expiré : répondre 401 (403 seulement pour un rôle insuffisant) | Test : jeton expiré → 401; le frontend renvoie vers la connexion | #108, `auth.middleware.js` | 6 nov. | [ ] |
| E5 | Élevée | Imposer l'algorithme du jeton (`algorithms: ['HS256']`) | Test : un jeton `alg: none` est refusé | #109, `utils/jwt.js` | 6 nov. | [ ] |
| E6 | Élevée | Cookie mal formé : 401 au lieu d'une erreur 500 | Test : cookie `%E0%A4%A` → 401 | #107, `utils/session.js` | 6 nov. | [ ] |
| E7 | Élevée | Révoquer la session à la déconnexion et au changement de mot de passe (version de session par compte) | Test : un cookie copié avant la déconnexion reçoit 401 après | #81 | 6 nov. | [ ] |
| E8 | Élevée | Retirer le jeton du corps JSON de la connexion (le cookie suffit) | Test : la réponse de `/api/auth/login` n'a plus de champ `token` | #82, `auth.service.js` | 6 nov. | [ ] |
| E9 | Élevée | Décider qui peut se connecter par GitHub (liste de comptes ou d'organisations, ou compte « en attente » activé par un superviseur) | Décision écrite dans `03-conception.md`, mise en œuvre et testée | #131 | 6 nov. | [ ] |
| E10 | Élevée | Exiger **1 approbation** avant la fusion dans les règles de protection de `main` | Une PR sans approbation ne peut plus être fusionnée (capture dans le ticket) | #88 | 6 nov. | [ ] |
| E11 | Moyenne | Temps de réponse identique pour un matricule inconnu (vérification bcrypt factice) | Test : l'écart de temps entre matricule connu et inconnu est négligeable | #90 | 9 nov. | [ ] |
| E12 | Moyenne | `Cache-Control: no-cache` sur `index.html` | `curl -I` sur `/` le montre; les fichiers `/assets/` gardent leur cache d'un an | #121, `nginx.conf.template` | 9 nov. | [ ] |
| E13 | Moyenne | Une seule couche pour `X-Frame-Options` et `nosniff` (Helmet **ou** nginx) | Chaque en-tête n'apparaît qu'une fois, avec une seule valeur | `app.js`, `nginx.conf.template` | 9 nov. | [ ] |
| E14 | Moyenne | Ajouter la connexion GitHub à `deploy/compose.yml` et `deploy/.env.example` | Une installation neuve avec `deploy/` propose la connexion GitHub | #102 | 9 nov. | [ ] |
| E15 | Moyenne | `set-passwords.js` : demander une confirmation explicite et refuser de tourner en production | Le script refuse sans `--oui`, et refuse si `NODE_ENV=production` | #124 | 9 nov. | [ ] |
| E16 | Moyenne | Une seule version de Node (CI, deux Dockerfiles, `engines`, `.nvmrc`) | Les quatre endroits indiquent la même version | #125 | 9 nov. | [ ] |
| E17 | Moyenne | Mettre à jour les dépendances : 26 vulnérabilités modérées (backend), 5 (frontend) | `npm audit` ne montre plus que ce qui n'a pas de correctif, avec la raison dans la PR | `package.json` | 9 nov. | [ ] |
| E18 | Moyenne | Ajouter HSTS sur Azure (Caddy) | `curl -I https://…` montre `Strict-Transport-Security` | Caddyfile sur Azure | 9 nov. | [ ] |
| E19 | Moyenne | Test bout en bout dans un navigateur (Playwright) : deux navigateurs, temps réel, une action refusée | Le test tourne dans la CI et devient rouge si on casse le temps réel | `.github/workflows/ci.yml` | 9 nov. | [ ] |
| E20 | Moyenne | Faire tourner les tests d'intégration contre un vrai PostgreSQL dans la CI | Le job CI démarre un service PostgreSQL et lance `tests/integration` | `ci.yml` | 9 nov. | [ ] |
| E21 | Moyenne | Animer la rétrospective complète du sprint 2 : bilan du changement du sprint 1, trois questions, un nouveau changement assigné | `docs/retrospectives/sprint-2.md` contient la partie de chacun et l'action assignée | `retrospectives/sprint-2.md` | 9 nov. | [ ] |
| E22 | Moyenne | Tenir la mêlée à chaque bloc et vérifier que le journal est commis le jour même | Une entrée par bloc depuis le 2 novembre, avec personnes, tickets et décisions | `journal.md` | à chaque bloc | [ ] |
| E23 | Moyenne | Déplacer les tickets dans le Project à chaque mêlée | Les changements d'état sont étalés sur les blocs, pas groupés à la fin | Project GitHub | à chaque bloc | [ ] |
| E24 | Faible | Retirer les marqueurs de conflit de `retrospectives/sprint-1.md` et le fichier `sprint 1 .txt` | Aucun `<<<<<<<` dans le dépôt | `docs/retrospectives/` | 11 nov. | [ ] |
| E25 | Faible | Ancienne clé JWT dans l'historique : noter dans `06-risques.md` qu'elle est compromise et ne doit jamais servir | Risque écrit; la clé n'est utilisée nulle part (vérifié le 2 novembre) | `06-risques.md` | 11 nov. | [ ] |
| E26 | Faible | Vérifier que chaque permission a un test de refus (API **et** WebSocket) | Liste des permissions et de leur test dans la PR | `tests/` | 11 nov. | [ ] |
| E27 | Faible | Ajouter une section « Sécurité » au README : CSRF, cookies, limite de connexion, permissions | Section présente et à jour | `README.md` | 11 nov. | [ ] |
| E28 | Faible | Préparer l'explication de la connexion et des permissions pour la revue de sprint | Tout membre de l'équipe peut l'expliquer en 2 minutes | — | 11 nov. | [ ] |
| E29 | Faible | Relire les PR des coéquipiers dans les 24 h | Aucune PR n'attend une revue plus de 24 h | — | continu | [ ] |
| E30 | Faible | Écrire au moins 2 idées dans la boîte à idées | 2 lignes signées « Eric » | ce document | 11 nov. | [ ] |

**Points à améliorer (Eric)** : ne fermer un ticket qu'avec la PR qui le corrige; pousser son travail à chaque bloc plutôt qu'en fin de sprint; tenir le rôle de responsable de la mêlée de façon visible (journal, Project).

---

## Chrysler — validations, données et API

| # | Gravité | Tâche | Terminé quand | Ticket / fichier | Échéance | Fait |
|---|---|---|---|---|---|---|
| C1 | Critique | Revoir les PR #170 (validations), #168 (version sur la modification complète) et #169 (journal d'audit) | Revue écrite avec un commentaire concret, puis fusion ou demande de changement | #94, #98, #100 | 4 nov. | [ ] |
| C2 | Critique | Revoir les PR #163, #164, #165, #166 et #167 | Revue écrite sur chacune | #87, #97, #101, #99, #91 | 4 nov. | [ ] |
| C3 | Élevée | Après la fusion de #170 : vérifier qu'un lieu vide, des caractères invisibles et une date future sont refusés | Tests verts; retest manuel décrit dans le ticket | #94 | 6 nov. | [ ] |
| C4 | Élevée | Après la fusion de #168 : une modification complète sans version, ou avec une version périmée, est refusée | Tests : sans version → 400, version périmée → 409 | #98 | 6 nov. | [ ] |
| C5 | Élevée | Journal d'audit : création de compte, création de dossier, changement de statut et d'adresse, connexions ratées | Test pour chaque action; visibles dans `/api/audit-logs` | #100 | 6 nov. | [ ] |
| C6 | Élevée | Décider la règle des signalements récents pour un policier (tout voir, ou pas l'historique d'un dossier) | Décision dans `03-conception.md`, code et test alignés | #93 | 6 nov. | [ ] |
| C7 | Élevée | Décider la règle de l'annuaire : ce qu'un policier voit des autres agents | Décision écrite, code et test alignés | #132 | 6 nov. | [ ] |
| C8 | Élevée | Lire une conversation ne doit rien écrire : route `POST …/read` séparée | `GET /api/messages/:userId` ne modifie plus `read_at`; test | #111 | 6 nov. | [ ] |
| C9 | Moyenne | JSON mal formé : `400 « Requête invalide »` en français | Test | #110, `app.js` | 9 nov. | [ ] |
| C10 | Moyenne | Route d'API inconnue : `404` en JSON (PR #164) | Test : `/api/nimporte` → 404 JSON | #97 | 9 nov. | [ ] |
| C11 | Moyenne | `DATABASE_URL` de `backend/.env` lue avant la connexion à la base (PR #165) | Test ou démarrage avec une autre base | #101 | 9 nov. | [ ] |
| C12 | Moyenne | Mode SQLite : le retirer (PR #163) ou le réparer, et l'écrire dans la conception | Plus de code mort; README à jour | #87 | 9 nov. | [ ] |
| C13 | Moyenne | Plafonner la file du géocodage (PR #167) | Test : au-delà de la limite → 429 | #91 | 9 nov. | [ ] |
| C14 | Moyenne | Swagger : toutes les routes, y compris réactions, pièces jointes, non-lus, modifier et supprimer un message | Chaque route de `routes/` apparaît dans `/api-docs` | #99 | 9 nov. | [ ] |
| C15 | Moyenne | Recherche insensible aux accents (`unaccent`) | « Bélléfeuille » trouve « Bellefeuille »; test | `criminal.model.js` | 9 nov. | [ ] |
| C16 | Moyenne | Index trigramme (`pg_trgm`) pour la recherche par nom | Migration ajoutée; `EXPLAIN` utilise l'index | #128 | 9 nov. | [ ] |
| C17 | Moyenne | `schema.sql` décrit la vraie base (avec `migrations.sql`) | Un lecteur comprend la base avec un seul fichier | #127 | 9 nov. | [ ] |
| C18 | Moyenne | Arrêt propre du serveur (`SIGTERM` : HTTP, sockets, base) | `docker compose down` s'arrête en moins de 2 s | #122 | 9 nov. | [ ] |
| C19 | Moyenne | Récit du sprint 3 : historique des signalements sur un dossier | Critères d'acceptation écrits, écran et tests | #17 | 9 nov. | [ ] |
| C20 | Moyenne | Récit du sprint 3 : gestion de la concurrence, message de conflit avec l'état actuel | Deux onglets : l'un réussit, l'autre voit l'état actuel; test | #15 | 9 nov. | [ ] |
| C21 | Moyenne | Message de conflit juste après un changement d'adresse | Le message dit ce qui a vraiment changé | #117 | 9 nov. | [ ] |
| C22 | Faible | Commentaires périmés | Liste du ticket corrigée | #123 | 11 nov. | [ ] |
| C23 | Faible | Tous les messages d'erreur de l'API en français, sans détail interne | Revue des contrôleurs dans la PR | `controllers/` | 11 nov. | [ ] |
| C24 | Faible | Tests d'intégration sur PostgreSQL pour les réactions et les appels manqués | Tests verts contre une vraie base | `tests/integration` | 11 nov. | [ ] |
| C25 | Faible | Avec Massyle : corriger les données abîmées sur Azure (« Test arm�e �t� ») | Plus de caractère `�` dans les alertes en ligne | base Azure | 11 nov. | [ ] |
| C26 | Faible | `GET /api/alerts` sans filtre : renvoyer aussi `total` | Test | `alerts.controller.js` | 11 nov. | [ ] |
| C27 | Faible | Tests des limites de la signalisation des appels (taille d'offre, candidat invalide) | Tests verts | `tests/unit/appels.test.js` | 11 nov. | [ ] |
| C28 | Faible | Mettre sa ligne de `05-equipe.md` à jour selon son historique Git | Ligne conforme à l'historique | `05-equipe.md` | 11 nov. | [ ] |
| C29 | Faible | Écrire ses entrées de journal le jour de chaque bloc | Une entrée par bloc | `journal.md` | à chaque bloc | [ ] |
| C30 | Faible | Écrire au moins 2 idées dans la boîte à idées | 2 lignes signées « Chrysler » | ce document | 11 nov. | [ ] |

**Points à améliorer (Chrysler)** : pousser une branche à chaque bloc (même inachevée); faire relire chaque PR; relier chaque commit à son ticket.

---

## Michael — interface, temps réel et documents

| # | Gravité | Tâche | Terminé quand | Ticket / fichier | Échéance | Fait |
|---|---|---|---|---|---|---|
| M1 | Critique | Revoir la PR #161 et tester un appel et un message vocal sur Azure avec deux vrais appareils | Revue écrite; résultat du test noté dans le ticket | #161 | 4 nov. | [ ] |
| M2 | Élevée | Reconnexion du temps réel : bandeau visible pendant la coupure, rattrapage des événements manqués sans doublon | Test : on coupe le réseau 30 s, on revient, rien ne manque | #120 | 6 nov. | [ ] |
| M3 | Élevée | Accueil : ne plus relancer 4 requêtes par agent à chaque événement | Mise à jour locale ou regroupée; mesure avant et après dans la PR | #129 | 6 nov. | [ ] |
| M4 | Élevée | Accessibilité au clavier : menu « ⋯ » de la messagerie (Échap, clic dehors), lignes du registre au clavier, annonces `aria-live` | Parcours complet au clavier sans souris | #118 | 6 nov. | [ ] |
| M5 | Élevée | Registre en cartes sur téléphone (comme la maquette E « Registre téléphone ») | À 320 px, plus de tableau à faire glisser | `PersonnesRecherchees.jsx`, `registre.css` | 6 nov. | [ ] |
| M6 | Élevée | Annuaire en cartes sur téléphone | À 320 px, plus de tableau à faire glisser | `Annuaire.jsx`, `pages.css` | 6 nov. | [ ] |
| M7 | Moyenne | Boutons texte d'au moins 40 px de haut au doigt (« Promouvoir », « Désactiver », « ← Registre », « Tout voir », « Annuler ») | Plus de cible de moins de 32 px dans l'audit mobile | `pages.css`, `registre.css` | 9 nov. | [ ] |
| M8 | Moyenne | Carte : repères et boutons de zoom plus grands sur téléphone | Repères d'au moins 32 px au doigt | `Carte.jsx` | 9 nov. | [ ] |
| M9 | Moyenne | Accueil : « Tout voir », « Dernier communiqué » et « il y a 2 min » qui se met à jour | Les trois défauts du ticket corrigés | #114 | 9 nov. | [ ] |
| M10 | Moyenne | Libellés des rôles et des grades dans un seul fichier; abréviations justes | Plus de copie dans `UserProfileMenu.jsx` et `Profil.jsx` | #112 | 9 nov. | [ ] |
| M11 | Moyenne | Accueil selon la direction E : bandeau d'alerte urgente, grande recherche | Conforme à la maquette « E · Accueil » | `Home.jsx` | 9 nov. | [ ] |
| M12 | Moyenne | Fiche d'un dossier selon la direction E : photo, signalements, zone « Retirer » visible | Conforme à « E · Fiche » | `FicheDossier.jsx` | 9 nov. | [ ] |
| M13 | Moyenne | Alertes : pastille « Urgent » ou « Info », gravité choisie par des boutons | La gravité se lit sans lire le texte | `Diffusions.jsx` | 9 nov. | [ ] |
| M14 | Moyenne | Statistiques : évolution par semaine (dossiers ajoutés et capturés, alertes) | Un graphique daté | `Statistiques.jsx` | 9 nov. | [ ] |
| M15 | Moyenne | Annuaire : boutons « Écrire » et « Appeler » sur chaque agent | Un clic ouvre la conversation ou l'appel | `Annuaire.jsx` | 9 nov. | [ ] |
| M16 | Moyenne | README à jour pour la bêta et le sprint 3 (plus d'« alpha », béquilles à jour) | Chaque section du README correspond à `main` | #104 | 9 nov. | [ ] |
| M17 | Moyenne | Retirer les fichiers qui traînent et aligner les numéros du backlog | `.vscode/`, `plan-equipe/` traités; `02-backlog.md` cohérent | #126 | 9 nov. | [ ] |
| M18 | Moyenne | Écrire les scénarios du test bout en bout (avec Eric, E19) | Scénarios dans la PR de E19 | — | 9 nov. | [ ] |
| M19 | Faible | Textes de moins de 12 px (sous-titres, étiquettes, en-têtes de tableau) portés à 12 px au moins | Plus de texte de moins de 12 px dans l'audit | CSS | 11 nov. | [ ] |
| M20 | Faible | Profil et page 404 selon la direction E | Conformes aux maquettes E | `Profil.jsx`, `Router.jsx` | 11 nov. | [ ] |
| M21 | Faible | Contraste et focus clavier visibles partout (Lighthouse Accessibilité ≥ 90) | Rapport Lighthouse dans la PR | — | 11 nov. | [ ] |
| M22 | Faible | Performance mobile : image de l'écusson (620 Ko) compressée | Lighthouse Performance mobile ≥ 80 | `assets/` | 11 nov. | [ ] |
| M23 | Faible | Maquettes bureau et téléphone à jour dans `docs/maquettes/` (direction E) | Une maquette par écran principal | `docs/maquettes/` | 11 nov. | [ ] |
| M24 | Faible | Messagerie : état « chargement » et erreurs visibles dans le fil | Une coupure affiche un message clair | `Messagerie.jsx` | 11 nov. | [ ] |
| M25 | Faible | Recherche de l'en-tête « Rechercher une fiche » : résultats au fil de la frappe | Test manuel décrit dans la PR | `Home.jsx` | 11 nov. | [ ] |
| M26 | Faible | Préparer la démonstration de la revue : deux navigateurs, deux rôles, temps réel, une action refusée | Script de 10 minutes écrit, répété une fois | — | 11 nov. | [ ] |
| M27 | Faible | Mettre sa ligne de `05-equipe.md` à jour selon son historique Git | Ligne conforme | `05-equipe.md` | 11 nov. | [ ] |
| M28 | Faible | Écrire ses entrées de journal le jour de chaque bloc | Une entrée par bloc | `journal.md` | à chaque bloc | [ ] |
| M29 | Faible | Écrire sa partie de la rétrospective du sprint 2 | Partie présente | `retrospectives/sprint-2.md` | 9 nov. | [ ] |
| M30 | Faible | Écrire au moins 2 idées dans la boîte à idées | 2 lignes signées « Michael » | ce document | 11 nov. | [ ] |

**Points à améliorer (Michael)** : tester chaque écran sur téléphone avant la PR; découper le travail d'interface en petites PR revues; garder le journal à jour le jour même.

---

## Massyle — Product Owner, intégration et mise en ligne

| # | Gravité | Tâche | Terminé quand | Ticket / fichier | Échéance | Fait |
|---|---|---|---|---|---|---|
| S1 | Critique | Assigner un relecteur à chacune de ses 10 PR (#161 à #170) et ne fusionner qu'après la revue | Chaque PR a une revue enregistrée avant sa fusion | #161–#170 | 4 nov. | [ ] |
| S2 | Critique | Écrire l'engagement du sprint 3 : objectif, points calés sur la vélocité, responsables, ordre d'abandon | Commit daté du début du sprint dans `04-sprints.md` | `04-sprints.md` | 4 nov. | [ ] |
| S3 | Critique | Écrire le bilan du sprint 2 en 5 lignes : points engagés, livrés, vélocité réelle, récits abandonnés et pourquoi | Bilan présent dans `04-sprints.md` | `04-sprints.md` | 4 nov. | [ ] |
| S4 | Élevée | Mettre tous les tickets ouverts dans le Project, avec un responsable et un état à jour | Aucun ticket ouvert hors du Project | Project GitHub | 6 nov. | [ ] |
| S5 | Élevée | Terminer le relais TURN (PR #162) et tester un appel entre un téléphone en 4G et un ordinateur en Wi-Fi | L'appel s'établit; résultat noté | #162 | 6 nov. | [ ] |
| S6 | Élevée | Tester sur Azure, avec un iPhone et un Android : appel audio, appel vidéo, caméra arrière, message vocal | Chaque cas noté OK ou ticket créé | — | 6 nov. | [ ] |
| S7 | Élevée | Azure : sauvegarde quotidienne de la base (`pg_dump`) et restauration testée | Une sauvegarde par jour; une restauration réussie | serveur Azure | 6 nov. | [ ] |
| S8 | Élevée | Azure : mémoire (887 Mo presque pleine) : passer à 2 Go, ou surveiller et redémarrer en cas de problème | Mémoire suffisante, ou alerte en place | serveur Azure | 6 nov. | [ ] |
| S9 | Moyenne | Reprendre la documentation de son travail du sprint 2 (04-sprints, 05-equipe, journal, conception) | Documents conformes à l'historique Git | commit `76b1b5c` | 9 nov. | [ ] |
| S10 | Moyenne | `06-risques.md` à jour : Azure, mémoire, TURN, données en ligne, ancienne clé JWT | Risques présents avec une parade | `06-risques.md` | 9 nov. | [ ] |
| S11 | Moyenne | Décider du compte rapide `1` / `2` : le garder pour la démonstration, ne pas le créer en production | Décision écrite; #73 et #86 commentés | #73, #86 | 9 nov. | [ ] |
| S12 | Moyenne | Avec Chrysler : corriger les données abîmées sur Azure | Plus de `�` en ligne | base Azure | 9 nov. | [ ] |
| S13 | Moyenne | Écrire le script de la revue de sprint (qui présente quoi, en 10 minutes) | Script dans le dépôt, répété une fois avec l'équipe | — | 9 nov. | [ ] |
| S14 | Moyenne | Préparer les comptes de démonstration pour la revue (un par rôle, plus un compte GitHub jamais vu) | Comptes testés la veille | README | 9 nov. | [ ] |
| S15 | Moyenne | Ajouter les variables du relais TURN à `.env.example` et `deploy/.env.example` | Chaque variable expliquée | `.env.example` | 9 nov. | [ ] |
| S16 | Moyenne | Vérifier la page GitHub Pages et sa redirection vers Azure | La redirection fonctionne; la page de secours est claire | `pages.yml` | 9 nov. | [ ] |
| S17 | Moyenne | Mesurer l'avancement à chaque bloc (points restants) et décider en conséquence | Tableau ou burndown dans `04-sprints.md`, décision datée dans le journal | `04-sprints.md` | à chaque bloc | [ ] |
| S18 | Moyenne | Aligner `02-backlog.md` sur les numéros des tickets (avec Michael, M17) | Les numéros correspondent | `02-backlog.md` | 9 nov. | [ ] |
| S19 | Faible | Messagerie : garder le brouillon d'un message quand on change de conversation | Le texte revient quand on revient | `Messagerie.jsx` | 11 nov. | [ ] |
| S20 | Faible | Messagerie : rechercher un mot dans une conversation | Les messages trouvés sont mis en évidence | `Messagerie.jsx` | 11 nov. | [ ] |
| S21 | Faible | Appels : sonnerie audible et « Rappeler » depuis la notification d'appel manqué | Test manuel décrit dans la PR | `AppelProvider.jsx` | 11 nov. | [ ] |
| S22 | Faible | Vérifier la mise en page sur de vrais téléphones (320 à 430 px) et une tablette | Captures jointes au ticket | — | 11 nov. | [ ] |
| S23 | Faible | Écrire la liste de remise (étiquette, `.env` sur MIO, README, documents) pour ne plus remettre en retard | Liste dans `docs/` | `docs/` | 11 nov. | [ ] |
| S24 | Faible | Installer CrimeTracker sur un autre ordinateur : clone neuf, `.env`, une seule commande du README | L'application s'ouvre et la connexion GitHub marche du premier coup | README | 11 nov. | [ ] |
| S25 | Faible | Relire les PR des coéquipiers dans les 24 h | Aucune PR n'attend plus de 24 h | — | continu | [ ] |
| S26 | Faible | Rendre `.env.example` complet et commenté | Chaque variable listée avec une valeur bidon | `.env.example` | 11 nov. | [ ] |
| S27 | Faible | Écrire ses entrées de journal le jour de chaque bloc | Une entrée par bloc | `journal.md` | à chaque bloc | [ ] |
| S28 | Faible | Compléter sa partie de la rétrospective avec l'action du sprint 3 | Action assignée et datée | `retrospectives/sprint-2.md` | 9 nov. | [ ] |
| S29 | Faible | Trier la boîte à idées : chaque idée devient un ticket, une décision « plus tard » ou un refus expliqué | Chaque idée a une suite | ce document | 11 nov. | [ ] |
| S30 | Faible | Écrire au moins 2 idées dans la boîte à idées | 2 lignes signées « Massyle » | ce document | 11 nov. | [ ] |

**Points à améliorer (Massyle)** : faire revoir chaque PR avant la fusion (aucune ne l'a été au sprint 2); livrer en petites PR tout au long du sprint plutôt qu'en deux gros lots; poser l'étiquette de remise le jour même; tester sur un vrai téléphone et sur Azure avant de dire « terminé ».

---

## Points à améliorer pour toute l'équipe

1. **Une revue par PR, avant la fusion**, par quelqu'un qui n'a pas écrit le code, avec un commentaire concret. Au sprint 2, 2 PR sur 30 ont été revues.
2. **Un ticket se ferme par la PR qui le corrige**, jamais à la main sans correction.
3. **Le journal s'écrit le jour du bloc**, avec des noms, des tickets et des décisions.
4. **Les tickets bougent à chaque mêlée**, pas tous à la fin.
5. **On pousse son travail à chaque bloc**, même inachevé.
6. **La remise se fait à l'heure** : étiquette posée et `.env` envoyé avant l'échéance.
7. **Chacun peut expliquer tout le projet**, en particulier la connexion et les permissions, pour la revue de sprint.

---

## Boîte à idées

Chacun écrit ici une idée (une fonction, une amélioration, un outil, une façon de travailler), même petite. Massyle les trie (tâche S29) : chaque idée devient un ticket, une décision « plus tard », ou un refus expliqué.

**Comment écrire une idée** : une ligne dans le tableau, avec votre nom, l'idée, le problème qu'elle règle, et pour qui.

| Proposée par | Idée | Ce qu'elle règle, pour qui | Suite (rempli par Massyle) |
|---|---|---|---|
| Massyle | Mode sombre pour le travail de nuit | Écran blanc qui éblouit dans l'auto-patrouille | |
| Massyle | Bouton « Je suis sur place » sur une alerte, visible par tous | Savoir qui répond déjà à une alerte | |
| Massyle | Photo d'un suspect ajoutée depuis le téléphone, sur la fiche | Les fiches sans photo sont difficiles à reconnaître | |
| Massyle | Carte : afficher les agents connectés (position partagée volontairement) | Envoyer l'agent le plus proche | |
| Massyle | Notification du navigateur avec un son distinct pour une alerte urgente | Ne pas rater une alerte quand l'onglet est caché | |
| Massyle | Application installable sur le téléphone (PWA) | Ouvrir CrimeTracker comme une application | |
| Massyle | Export PDF d'une fiche de dossier | Imprimer ou transmettre une fiche | |
| Massyle | Filtres de la carte par statut et par date | Voir seulement les signalements récents | |
| Massyle | Modèles de messages rapides (« Reçu », « En route », « Besoin de renfort ») | Répondre d'un geste sur le terrain | |
| Massyle | Mot de passe oublié par lien à usage unique | Ne plus dépendre d'un superviseur | |
| Massyle | Double authentification (TOTP) pour la direction | Protéger les comptes les plus puissants | |
| Massyle | Tableau de bord de la direction : temps moyen entre « recherché » et « capturé » | Mesurer l'efficacité | |
| Massyle | Traduction anglaise de l'interface | Agents anglophones | |
| Massyle | Mode hors ligne : consulter les dernières fiches sans réseau | Zones sans couverture | |
| Massyle | Historique des appels (passés, reçus, manqués) | Retrouver qui a appelé | |
| Massyle | Partage de position en direct pendant un appel | Guider un collègue | |
| Massyle | Recherche par signes distinctifs (tatouage, véhicule) | Retrouver un dossier sans le nom | |
| Massyle | Tests de charge automatiques à chaque sprint (100 agents) | Ne pas casser les performances sans le voir | |
| Massyle | Page « Quoi de neuf » après chaque mise à jour | Que les agents découvrent les nouveautés | |
| Massyle | Sondage rapide de satisfaction auprès des agents testeurs | Savoir quoi améliorer en premier | |
| Eric | | | |
| Eric | | | |
| Chrysler | | | |
| Chrysler | | | |
| Michael | | | |
| Michael | | | |

---

## Suivi

| Personne | Critiques | Élevées | Moyennes | Faibles | Total |
|---|---|---|---|---|---|
| Eric | 3 | 7 | 13 | 7 | 30 |
| Chrysler | 2 | 6 | 13 | 9 | 30 |
| Michael | 1 | 5 | 12 | 12 | 30 |
| Massyle | 3 | 5 | 10 | 12 | 30 |
| **Équipe** | **9** | **23** | **48** | **40** | **120** |

Point d'étape à chaque bloc (mêlée de 10 minutes) : chacun dit ce qu'il a terminé, ce qu'il fait ensuite, et ce qui le bloque. **Date limite : mercredi 11 novembre 2026.**
