# Plan des trois sprints — CrimeTracker

---

## Sprint 1 — Alpha (~3 semaines)

**Objectif** : L'application fonctionne de bout en bout — un agent peut se connecter, consulter et gérer le registre des personnes recherchées, le tout dans un environnement conteneurisé avec une chaîne CI verte.

**Incrément démontrable** : démo en direct où on se connecte, on ajoute un criminel, on met à jour son statut et on le retire — depuis Docker sur n'importe quelle machine.

### Récits prévus

| # | Récit | Points |
|---|---|---|
| 1 | S'authentifier avec badge et mot de passe | 5 |
| 2 | Consulter la liste des personnes recherchées | 2 |
| 3 | Voir le profil complet d'un dossier | 3 |
| 4 | Ajouter un nouveau dossier (policier) | 5 |
| 5 | Retirer un dossier (superviseur) | 3 |
| 6 | Mettre à jour le statut d'un dossier | 3 |
| 7 | Filtrer et rechercher les dossiers | 3 |
| **Total** | | **24 pts** |

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
- **Ordre d'abandon** : celui de la section [Ordre d'abandon](#ordre-dabandon); pour le sprint 1, le filtre avancé (#7 du tableau, ticket #9) part en premier, la recherche par nom reste.
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

| # | Récit | Points |
|---|---|---|
| 8 | Créer le compte d'un nouvel agent | 3 |
| 14 | Désactiver un compte agent | 2 |
| 9 | Tableau de bord temps réel (alertes et mises à jour) | 8 |
| 10 | Diffuser une alerte urgente | 5 |
| 11 | Signaler une observation terrain | 5 |
| **Total** | | **23 pts** |

### Notions disponibles
Authentification externe (OAuth 2 / OIDC), rôles et autorisations, programmation sécurisée, protocole WebSocket / Socket.IO (début).

---

## Sprint 3 — Version finale (~5 semaines)

**Objectif** : Le temps réel est complet (présence, resynchronisation après déconnexion), la concurrence est gérée correctement, et l'application est déployée sur un serveur public.

**Incrément démontrable** : deux onglets tentent de marquer le même criminel comme « capturé » simultanément — un réussit, l'autre reçoit un message d'erreur avec l'état actuel. L'application est accessible en ligne.

### Récits prévus

| # | Récit | Points |
|---|---|---|
| 12 | Voir les agents connectés en temps réel | 3 |
| 13 | Gestion de la concurrence (verrouillage optimiste) | 8 |
| 15 | Historique des signalements sur un dossier | 3 |
| 16 | Journal d'audit des actions sensibles | 5 |
| 17 | Statistiques globales (Could) | 5 |
| + | Déploiement, peaufinage, tests e2e | — |
| **Total** | | **~24 pts** |

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
