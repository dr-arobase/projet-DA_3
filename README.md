# CrimeTracker

[![Intégration Continue](https://github.com/dr-arobase/projet-DA_3/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/dr-arobase/projet-DA_3/actions/workflows/ci.yml)

CrimeTracker est une application web dédiée aux policiers nationaux pour centraliser le registre des personnes recherchées et améliorer la coordination sur le terrain. Elle permet de consulter, mettre à jour et diffuser les informations rapidement, avec une visibilité en temps réel pour tous les effectifs connectés.

**Équipe** : Massyle (Product Owner), Eric (Scrum Master), Chrysler et Michael (testeurs)

---

## Démarrer l'application

Seul [Docker](https://www.docker.com/) est nécessaire :

```bash
docker compose up --build
```

Puis ouvrir **http://localhost:8080**. La documentation de l'API (Swagger) est sur http://localhost:8080/api-docs.

Au premier démarrage, l'API crée les tables et insère les données de départ. Les données sont conservées dans un volume Docker : elles survivent à `docker compose down` (mais pas à `docker compose down -v`).

Les valeurs par défaut suffisent en local. Pour les changer, copier `.env.example` en `.env`.

## Comptes de démonstration

Chargés automatiquement au démarrage depuis `backend/serveur/database/seed.sql`.

| Rôle | Matricule | Mot de passe |
|---|---|---|
| Direction | `PO-001` | voir [#25](https://github.com/dr-arobase/projet-DA_3/issues/25) |
| Superviseur | `SM-002` | voir [#25](https://github.com/dr-arobase/projet-DA_3/issues/25) |
| Policier | `PL-003` | voir [#25](https://github.com/dr-arobase/projet-DA_3/issues/25) |

> Les mots de passe de démonstration sont en cours d'ajout (ticket #25) : cette section sera complétée avec les identifiants.

## Lancer les tests

```bash
cd backend
npm install
npm test
```

Les tests d'intégration utilisent la base PostgreSQL : lancer d'abord `docker compose up -d postgres`. Sans base, ils sont ignorés et les autres tests s'exécutent.

Pour faire la même vérification que la CI (tests, démarrage du serveur, build du frontend) : `npm run verifier` à la racine.

## Éléments simulés

Ce qui n'est pas encore réel dans la version alpha (ticket [#26](https://github.com/dr-arobase/projet-DA_3/issues/26) pour l'annoncer aussi à l'écran) :

| Élément | État actuel | Remplacé par | Sprint |
|---|---|---|---|
| Chiffres de la page de connexion (fiches, agents, alertes) | Valeurs fixes | Statistiques réelles de l'API | 3 |
| Pastilles du menu (Alertes, Messagerie) | Valeurs fixes | Nombre réel d'alertes non lues | 2 |
| Recherche et cloche du tableau de bord | Sans effet | Recherche dans le registre, notifications | 1 et 2 |
| Pages Alertes, Communiqués, Messagerie, Annuaire, Carte, Statistiques, Utilisateurs | « Page en construction » | Pages réelles | 2 et 3 |

Le tableau de bord (fiches, captures, alertes, agents connectés, activité) utilise déjà les vraies données et se met à jour en temps réel.

## Développement

Pour développer avec rechargement automatique, ne démarrer que la base avec Docker :

```bash
docker compose up -d postgres
cd backend  && npm install && npm run dev   # API sur http://localhost:3000
cd frontend && npm install && npm run dev   # interface sur http://localhost:5173
```

Les règles de travail (branches, commits, pull requests, définition de terminé) sont dans [CONTRIBUTING.md](CONTRIBUTING.md).

## Structure du dépôt

```
backend/            API Express + Socket.IO, tests Jest
  serveur/src/      routes, controllers, services, models, middleware, sockets
  serveur/tests/    tests unitaires, de routes et d'intégration
  serveur/database/ schema.sql et seed.sql
frontend/           interface React + Vite, servie par nginx en production
deploy/             lancement sur un serveur à partir des images publiées
docs/               vision, backlog, conception, sprints, équipe, risques, journal, maquettes
scripts/            vérification avant push (tests, démarrage, build)
.github/            CI et modèles d'issues et de pull requests
```

## Documentation

- [Backlog GitHub (Project)](https://github.com/users/dr-arobase/projects/2)
- [Issues](https://github.com/dr-arobase/projet-DA_3/issues)
- [Vision et portée](docs/01-vision.md)
- [Backlog produit](docs/02-backlog.md)
- [Conception technique](docs/03-conception.md)
- [Plan des sprints](docs/04-sprints.md)
- [Organisation de l'équipe](docs/05-equipe.md)
- [Risques](docs/06-risques.md)
- [Journal](docs/journal.md)
- [Rétrospective du sprint 1](docs/retrospectives/sprint-1.md)
- [Maquettes](docs/maquettes/README.md)
