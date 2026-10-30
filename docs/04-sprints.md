# Plan des trois sprints — CrimeTracker

---

## Sprint 1 — Alpha (~3 semaines)

**Objectif** : L'application fonctionne de bout en bout — un agent peut se connecter, consulter et gérer le registre des personnes recherchées, le tout dans un environnement conteneurisé avec une chaîne CI verte.

**Incrément démontrable** : démo en direct où on se connecte, on ajoute un criminel, on met à jour son statut et on le retire — depuis Docker sur n'importe quelle machine.

### Récits prévus

| #               | Récit                                        | Points           |
| --------------- | --------------------------------------------- | ---------------- |
| 1               | S'authentifier avec badge et mot de passe     | 5                |
| 2               | Consulter la liste des personnes recherchées | 2                |
| 3               | Voir le profil complet d'un dossier           | 3                |
| 4               | Ajouter un nouveau dossier (policier)         | 5                |
| 5               | Retirer un dossier (superviseur)              | 3                |
| 6               | Mettre à jour le statut d'un dossier         | 3                |
| 7               | Filtrer et rechercher les dossiers            | 3                |
| **Total** |                                               | **24 pts** |

### Capacité

- 4 membres × 4 h/semaine (hors cours) × 3 semaines = **48 heures**
- Référence : 1 point ≈ 2 h de travail effectif → **capacité estimée : 24 points**
- On vise 24 points — plan tendu mais réaliste si on ne dévie pas.

### Notions disponibles

Docker, PostgreSQL, React Router v7 (SSR), tests et CI/GitHub Actions.

### Engagement réel du sprint 1

- **Objectif en une phrase** : un agent se connecte et gère le registre des personnes recherchées de bout en bout (liste, fiche, ajout, statut, retrait), dans une application qui démarre avec `docker compose up` et dont la CI est verte.
- **Récits engagés** : #1, #2, #3, #4, #5, #6, #7 du tableau ci-dessus, soit **24 points** (tickets GitHub #3 à #9).
- **Capacité** : 4 membres × 4 h/semaine × 3 semaines = 48 h, soit environ **24 points** (1 point ≈ 2 h).
- **Ordre d'abandon** : celui de la section [Ordre d&#39;abandon](#ordre-dabandon); pour le sprint 1, le filtre avancé (#7 du tableau, ticket #9) part en premier, la recherche par nom reste.
- **Responsable de la mêlée** : Eric (Scrum Master).
- **Ajouts en cours de sprint** (non engagés, donc hors vélocité) : le temps réel a été préparé dès le sprint 1 (Socket.IO, tableau de bord en direct), ainsi que la gestion des rôles et la page « Mon profil » (photo, changement de mot de passe).

### Bilan du sprint 1

État final au 6 octobre. Rappel de l'énoncé : un récit à moitié fait vaut **zéro** point; un récit est livré seulement s'il respecte la définition de « terminé » de `05-equipe.md` (PR revue, CI verte, ticket fermé).

| Ticket | Récit | Points | Backend (API + tests) | Page dans le navigateur | Fermé par | Livré selon la DoD ? |
|---|---|---|---|---|---|---|
| #3 | S'authentifier avec badge et mot de passe | 5 | Fait | Fait | Poussées directes sur `main` (30 sept.) | **Non** : fonctionnel, mais jamais passé par une PR revue |
| #4 | Consulter la liste paginée | 2 | Fait | Fait | [PR #35](https://github.com/dr-arobase/projet-DA_3/pull/35) | Oui |
| #5 | Voir la fiche complète d'un dossier | 3 | Fait | Fait | [PR #35](https://github.com/dr-arobase/projet-DA_3/pull/35) | Oui |
| #6 | Ajouter un dossier | 5 | Fait | Fait | [PR #35](https://github.com/dr-arobase/projet-DA_3/pull/35) | Oui |
| #7 | Retirer un dossier (superviseur) | 3 | Fait | Fait | [PR #35](https://github.com/dr-arobase/projet-DA_3/pull/35) | Oui |
| #8 | Mettre à jour le statut | 3 | Fait (avec `version`, 409 si conflit) | Fait, conflit affiché | [PR #35](https://github.com/dr-arobase/projet-DA_3/pull/35) | Oui |
| #9 | Filtrer et rechercher | 3 | Fait (statut + nom) | Fait | [PR #35](https://github.com/dr-arobase/projet-DA_3/pull/35) | Oui |

Les sept parcours fonctionnent de bout en bout dans le navigateur. Les écrans du registre (#4 à #9) ont été écrits tard, le 2 octobre, et livrés dans une seule PR (#35) revue par Eric : des PR plus petites, une par ticket, auraient permis une revue plus utile. L'authentification (#3) a été construite par poussées directes sur `main`, avant que la branche soit protégée : on ne la compte pas comme livrée au sens strict de notre définition de « terminé ».

Bilan en cinq lignes :

1. **Points engagés** : 24 (tickets #3 à #9).
2. **Points livrés** : 19 selon la définition de « terminé » (#4 à #9); 24 si l'on compte #3, fonctionnel et testé mais fusionné sans PR revue.
3. **Vélocité réelle** : **19 points**, valeur retenue pour planifier le sprint 2 (le plan actuel du sprint 2, 23 points, sera ramené à cette capacité).
4. **Récits abandonnés et pourquoi** : aucun. L'ordre d'abandon n'a pas eu à servir : le filtre avancé (#9), premier à couper, a été livré avec la recherche par nom.
5. **Ce qu'on change** : voir la rétrospective (`retrospectives/sprint-1.md`).

**Note sur le journal** : les entrées des blocs du sprint 1 dans `journal.md` n'ont pas été commises le jour de chaque bloc; elles ont été ajoutées après coup, le 6 octobre ([PR #37](https://github.com/dr-arobase/projet-DA_3/pull/37)). L'historique Git fait foi pour les dates réelles du travail.

---

## Sprint 2 — Beta (~3 semaines)

**Objectif** : Les rôles et autorisations sont réellement appliqués, et la première version du tableau de bord temps réel est fonctionnelle — les agents voient les changements en direct.

**Incrément démontrable** : deux navigateurs ouverts côte à côte — quand un policier ajoute un dossier dans l'un, il apparaît dans l'autre en moins d'une seconde. Une alerte urgente diffusée dans l'un s'affiche dans l'autre instantanément.

### Récits prévus

| #               | Récit                                                 | Points           |
| --------------- | ------------------------------------------------------ | ---------------- |
| 8               | Créer le compte d'un nouvel agent                     | 3                |
| 14              | Désactiver un compte agent                            | 2                |
| 9               | Tableau de bord temps réel (alertes et mises à jour) | 8                |
| 10              | Diffuser une alerte urgente                            | 5                |
| 11              | Signaler une observation terrain                       | 5                |
| **Total** |                                                        | **23 pts** |

### Notions disponibles

Authentification externe (OAuth 2 / OIDC), rôles et autorisations, programmation sécurisée, protocole WebSocket / Socket.IO (début).

### Ce que l'énoncé exige pour la bêta

Remise : étiquette `beta-v1` sur `main`, le **jeudi 29 octobre 2026 à 23 h 59**, et le `.env` envoyé en privé sur MIO. Points de contrôle : **lundi 19 octobre** (méthode agile) et **lundi 26 octobre** (la bêta tient debout). Revue de sprint : premier cours de la semaine 10.

En plus de tout ce qui était vérifié à l'alpha, l'application à l'étiquette `beta-v1` doit satisfaire les cinq points suivants :

1. Un clone neuf, le `.env` transmis en privé et une commande du README suffisent : l'application s'ouvre dans un navigateur, sans rien installer d'autre que Docker.
2. On se connecte avec un compte GitHub (OAuth 2), même un compte jamais vu, qui reçoit le rôle par défaut prévu dans `03-conception.md`. On se déconnecte aussi.
3. Les rôles et les permissions sont appliqués **par le serveur**, y compris quand on tape l'adresse, qu'on envoie la requête à la main ou qu'on passe par le WebSocket.
4. Au moins un parcours temps réel passe par WebSocket entre deux navigateurs, et ce qui doit durer est en base.
5. Les parcours engagés fonctionnent de bout en bout, des tests automatisés les couvrent, et la CI est verte à l'étiquette.

Sécurité exigée :
- cookies `HttpOnly` et `SameSite` ;
- protection contre la falsification de requête (CSRF) ;
- affichage échappé (XSS) ;
- entrées validées côté serveur, messages WebSocket compris ;
- aucun secret dans le dépôt, et le secret OAuth ne parvient jamais au navigateur.

Chaque PR doit aussi être revue par un coéquipier avant la fusion.

### Engagement réel du sprint 2

> **Écrit le 15 octobre, en retard.** L'énoncé demandait la planification commise au plus tard à la fin du bloc du 9 octobre. Elle n'a pas été tenue à ce moment, et nous l'écrivons maintenant plutôt que de la dater après coup. Le retard est noté dans `journal.md`.

- **Objectif en une phrase** : l'application sait qui est connecté (mot de passe ou GitHub), ce que chacun a le droit de faire (vérifié par le serveur), et elle réagit en temps réel entre agents.
- **Capacité** : la vélocité réelle du sprint 1, soit **19 points**.
- **Responsable de la mêlée** : Eric.

Les numéros sont ceux des tickets GitHub. Le tableau « Récits prévus » ci-dessus utilise les numéros du backlog (`02-backlog.md`).

| Ticket | Récit | Points | Responsable | État au 15 octobre |
|---|---|---|---|---|
| #50 | Se connecter avec un compte GitHub (OAuth 2) | 5 | Massyle | Code livré (PR #51), fusionné sans revue : à faire revoir |
| #11 | Tableau de bord temps réel (alertes et mises à jour) | 8 | Michael | Code présent depuis le début du sprint ; reste à vérifier chaque critère, ajouter les tests et fermer le ticket par une PR revue |
| #12 | Diffuser une alerte urgente | 5 | Chrysler | Code présent ; l'audit du 15 octobre trouve des validations manquantes (message vide ou trop long, dossier inexistant) |
| #16 | Désactiver un compte | 2 | Eric | Code présent mais **incomplet** : un compte désactivé garde l'accès à l'API et au WebSocket jusqu'à 8 h |
| **Total** | | **20** | | |

**Écart avec la vélocité (+1 point)** : la connexion GitHub (#50) est une exigence de l'énoncé de la bêta qui manquait au plan initial. On l'ajoute et on retire deux récits de l'engagement pour rester près de 19 points :
- **Créer un compte** (#10, 3 points, Chrysler) ;
- **Signaler une observation** (#13, 5 points, Michael).

Leur code existe déjà ; ils seront validés si le temps le permet, mais ne comptent pas dans la vélocité.

**Ordre d'abandon du sprint 2**, décidé maintenant :
1. #13 et #10, qui sont hors engagement.
2. #16, la désactivation de compte (`Should`).

On ne coupe jamais #50 (connexion GitHub), #11 (temps réel) ni #12 (alerte urgente) : ce sont des `Must` de la bêta.

**Ajouts hors engagement** : ils ne comptent pas dans la vélocité. Ce sont les tickets #53 à #55, #62 à #66 et #71, décrits plus bas, ainsi que #56 à #59 (appels, fichiers, emojis, messages vocaux), qui sont reportés au sprint 3.

**Changements décidés à la rétrospective du sprint 1, et où ils en sont :**

| Changement | Responsable | Où on en est au 15 octobre |
|---|---|---|
| Une PR par ticket | Chrysler | Appliqué : chaque ajout du sprint a sa branche, son ticket et sa PR |
| Revue de chaque PR dans les 24 h, avec un commentaire concret | Chrysler | **Pas appliqué** : les 8 PR du sprint ont été fusionnées sans revue, et la protection de `main` n'exige aucune approbation. **À faire** : demander les revues après coup et configurer `main` pour exiger 1 approbation |
| Journal commis à la fin de chaque bloc | Michael | **Pas appliqué** : le journal s'arrête au 6 octobre. Les blocs du 8 et du 9 octobre restent à documenter; aucune entrée rétrospective n'est ajoutée sans source vérifiable |
| Tickets déplacés dans le Project à chaque mêlée | Massyle | En partie : les tickets des ajouts sont créés, assignés et fermés par leurs PR. Les récits engagés n'ont pas bougé |
| Chaque membre responsable d'au moins un récit | Eric | Fait dans le tableau ci-dessus |

**Contrôle documentaire du point 9** : la consultation des revues GitHub pour les PR #51, #52, #60, #61, #68, #69, #70 et #72 n'a renvoyé aucune revue enregistrée. Une recherche dans le dépôt n'a trouvé aucun relevé de burndown; le responsable confirme ne pas disposer de données fiables pour les blocs manquants. Aucun graphique ni journal rétrospectif n'est donc reconstitué. La protection de `main` et le Project ne sont pas modifiés par ce constat.

### Travail réalisé par Massyle (au 15 octobre)

| PR | Ticket(s) | Contenu |
|---|---|---|
| #51 | #50 | Connexion GitHub (OAuth 2) avec la bibliothèque arctic : `state` vérifié contre la falsification, compte jamais vu créé avec le rôle policier, 18 tests (décision 10) |
| #60 | #53 | Annuaire : prénom, nom et matricule des agents connectés |
| #61 | #54, #55 | Messagerie : seulement les conversations existantes, recherche d'un agent pour en commencer une, groupes de discussion (le créateur gère les membres, un non-membre reçoit `403`), 29 tests dont 4 sur un vrai PostgreSQL |
| #68 | #62 | Accents « ?? » réparés dans les données de départ, fichiers SQL forcés en UTF-8 |
| #69 | #63 | Notification des alertes et des communiqués sur toutes les pages, et notification du navigateur en arrière-plan |
| #70 | #64, #65, #66 | Dernière adresse connue d'un dossier placée sur la carte (géocodage Nominatim côté serveur, décision 11), adresse d'un signalement écrite à la main, recherche de dossier par nom ou numéro |
| #72 | #71 | Les erreurs ne renvoient plus de détail interne au navigateur (chemin du serveur, message SQL) |
| #52 | — | Compte rapide de l'équipe ajouté au démarrage s'il manque |
| — | #67 | Vérification de bout en bout à travers nginx avec de vrais clients Socket.IO : 59 vérifications sur 59, puis audit de sécurité et des cas limites (voir les tickets créés le 15 octobre) |

Toutes ces PR ont été fusionnées **sans revue d'un coéquipier**, ce qui ne respecte pas notre définition de « terminé ». Une revue après coup est demandée pour chacune, voir le tableau des changements ci-dessus.

### Travail réalisé par Michael — sprint 2

Le parcours #11 a été finalisé dans une branche dédiée, puis vérifié avant son intégration :

| Commit | Date | Contribution |
|---|---|---|
| [`74f6955`](https://github.com/dr-arobase/projet-DA_3/commit/74f6955) | 28 octobre 2026 | Correction des parcours temps réel et de la carte; propagation des mises à jour, rafraîchissement, notifications et accès aux pages concernés |
| [`3126b96`](https://github.com/dr-arobase/projet-DA_3/commit/3126b96) | 28 octobre 2026 | Intégration des corrections du sprint 2; fermeture du récit #11 |
| [`9ea8e72`](https://github.com/dr-arobase/projet-DA_3/commit/9ea8e72) | 29 octobre 2026 | Mise à jour du journal et des contributions du sprint 2 |
| [`18c25f9`](https://github.com/dr-arobase/projet-DA_3/commit/18c25f9) | 30 octobre 2026 | Mise à jour finale du journal et des contributions du sprint 2 |

La correction fonctionnelle est rattachée à la [PR #136](https://github.com/dr-arobase/projet-DA_3/pull/136), qui a été revue et fusionnée. L'historique Git constitue la trace vérifiable des poussées et des intégrations; Git ne conserve pas un registre séparé de chaque commande `git push`.

---

## Sprint 3 — Version finale (~5 semaines)

**Objectif** : Le temps réel est complet (présence, resynchronisation après déconnexion), la concurrence est gérée correctement, et l'application est déployée sur un serveur public.

**Incrément démontrable** : deux onglets tentent de marquer le même criminel comme « capturé » simultanément — un réussit, l'autre reçoit un message d'erreur avec l'état actuel. L'application est accessible en ligne.

### Récits prévus

| #               | Récit                                             | Points            |
| --------------- | -------------------------------------------------- | ----------------- |
| 12              | Voir les agents connectés en temps réel          | 3                 |
| 13              | Gestion de la concurrence (verrouillage optimiste) | 8                 |
| 15              | Historique des signalements sur un dossier         | 3                 |
| 16              | Journal d'audit des actions sensibles              | 5                 |
| 17              | Statistiques globales (Could)                      | 5                 |
| +               | Déploiement, peaufinage, tests e2e                | —                |
| **Total** |                                                    | **~24 pts** |

### Notions disponibles

Socket.IO (présence, état partagé), gestion de la concurrence, déploiement.

---

## Ordre d'abandon

Si l'équipe prend du retard, voici l'ordre dans lequel on coupe — décidé maintenant, à froid :

1. **Statistiques globales** (#17, `Could`) — aucune valeur fonctionnelle pour la correction
2. **Journal d'audit** (#16, `Should`) — utile mais non démontrable facilement
3. **Historique des signalements** (#15, `Should`) — le signalement reste, l'historique saute
4. **Désactivation de compte** (#14, `Should`) — on garde la création de compte
5. **Filtre avancé** (#7) — on conserve la recherche par nom, on retire les filtres secondaires

On ne coupe jamais : authentification, registre de base, tableau de bord temps réel, gestion de la concurrence. Ce sont les récits `Must` qui définissent l'application.
