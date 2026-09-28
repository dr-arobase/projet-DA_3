# CrimeTracker

CrimeTracker est une application web dédiée aux policiers nationaux pour centraliser le registre des personnes recherchées et améliorer la coordination sur le terrain. Elle permet de consulter, mettre à jour et diffuser les informations rapidement, avec une visibilité en temps réel pour tous les effectifs connectés. L’objectif est de réduire les erreurs, accélérer les interventions et sécuriser la gestion des dossiers sensibles.

**Équipe** : Massyle, Eric, Chrysler, Michael

---

## Démarrer l'application

Seul **Docker** est requis. Depuis la racine d'un clone neuf :

```bash
docker compose up --build
```

Puis ouvrir **<http://localhost:3000>**.

- La base PostgreSQL est créée automatiquement au premier démarrage (`backend/serveur/database/schema.sql`), puis remplie avec les données de démonstration (`seed.sql`).
- Les données sont dans le volume Docker `crimetracker-db-data` : elles **survivent** à `docker compose down` / `docker compose up`.
- Pour repartir d'une base vide : `docker compose down --volumes`.
- Documentation interactive de l'API (Swagger) : **<http://localhost:3000/api-docs>**.

La configuration par défaut convient au développement local. Pour la changer, copier [`.env.example`](.env.example) en `.env` (jamais commis).

## Exécuter les tests

```bash
docker compose run --rm tests
```

Les tests (Jest + Supertest) tournent contre un vrai PostgreSQL, dans une base séparée `crimetracker_test` qu'ils vident et recréent à chaque exécution : les données de l'application ne sont jamais touchées. La même suite s'exécute dans GitHub Actions à chaque poussée ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)), suivie d'une vérification que `docker compose up` démarre bien l'application.

Sans Docker, avec Node 22 et un PostgreSQL local : `cd backend && npm ci && npm test` (variable `DATABASE_URL` vers une base dont le nom finit par `_test`).

## Comptes de démonstration

Chargés automatiquement au premier démarrage. Mot de passe commun : **`Demo1234!`**

| Rôle | Matricule | Nom | Ce que le rôle permet |
|---|---|---|---|
| Policier | `PL-003` | Chrysler Jean | Consulter, rechercher, ajouter un dossier, changer son statut |
| Policier | `PL-004` | Michael Fortin | Idem |
| Superviseur | `SM-002` | Eric Tremblay | Idem + **retirer** un dossier |
| Direction | `PO-001` | Massyle Riahi | Idem superviseur |
| Policier *désactivé* | `PL-005` | Compte Désactivé | Aucun : sert à montrer le refus de connexion |

## Parcours livrés (sprint 1)

| Récit | Parcours | Ticket |
|---|---|---|
| #1 S'authentifier | Connexion par matricule et mot de passe → tableau de bord ; session par cookie jusqu'à la déconnexion ; erreurs : champs vides, identifiants invalides, compte désactivé, page demandée sans être connecté | [#3](https://github.com/dr-arobase/projet-DA_3/issues/3) |
| #2 Liste paginée | Registre → 10 dossiers par page (nom, statut, vignette), pagination sans recharger la page | [#4](https://github.com/dr-arobase/projet-DA_3/issues/4) |
| #3 Profil complet | Clic sur un dossier → identité, photo, crimes, statut, historique des statuts ; identifiant inexistant → « Dossier introuvable » | [#5](https://github.com/dr-arobase/projet-DA_3/issues/5) |
| #4 Ajouter un dossier | Formulaire → validation serveur (message sous chaque champ) → le dossier apparaît en tête de liste | [#6](https://github.com/dr-arobase/projet-DA_3/issues/6) |
| #5 Retirer un dossier | Superviseur ou direction, depuis le profil, avec confirmation ; le bouton n'existe pas pour un policier et l'API répond 403 | [#7](https://github.com/dr-arobase/projet-DA_3/issues/7) |
| #6 Changer le statut | Depuis le profil ; horodaté, auteur enregistré ; version périmée → refus explicite avec l'état actuel | [#8](https://github.com/dr-arobase/projet-DA_3/issues/8) |
| #7 Filtrer et rechercher | Recherche par nom combinable avec un filtre de statut ; aucun résultat → message clair | [#9](https://github.com/dr-arobase/projet-DA_3/issues/9) |

## Ce qui est simulé dans l'alpha

| Béquille | Où on la voit | Remplacée par | Sprint |
|---|---|---|---|
| Dossiers, signalement et alerte pré-chargés sont **fictifs** | Étiquette « Données de démonstration » au-dessus du registre | Dossiers saisis par les policiers | Au déploiement (sprint 3) |
| Double authentification (code TOTP, décision 1 de `03-conception.md`) **absente** : mot de passe seul | Étiquette « À venir — sprint 2 » sur l'écran de connexion | Code d'une application d'authentification | 2 |
| Photo donnée par une **adresse web** ; sans photo, une vignette à initiales | Étiquette « À venir — sprint 2 » sous le champ Photo | Téléversement d'un fichier depuis l'appareil | 2 |
| **Alertes en temps réel** absentes du tableau de bord | Encadré « Alertes en temps réel — À venir » sur le tableau de bord | Socket.IO (récits #9 et #10) | 2 |

## Liens

- [Backlog GitHub (Project)](https://github.com/users/dr-arobase/projects/1)
- [Issues GitHub](https://github.com/dr-arobase/projet-DA_3/issues)
- [Vision et portée](docs/01-vision.md)
- [Backlog produit](docs/02-backlog.md)
- [Conception technique](docs/03-conception.md)
- [Plan des sprints](docs/04-sprints.md)
- [Organisation de l'équipe](docs/05-equipe.md)
- [Risques](docs/06-risques.md)
- [Journal](docs/journal.md)
- [Maquettes](docs/maquettes/README.md)
