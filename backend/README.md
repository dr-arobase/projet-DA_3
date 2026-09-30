# CrimeTracker

CrimeTracker est une application web dédiée aux policiers nationaux pour centraliser le registre des personnes recherchées et améliorer la coordination sur le terrain. Elle permet de consulter, mettre à jour et diffuser les informations rapidement, avec une visibilité en temps réel pour tous les effectifs connectés. L’objectif est de réduire les erreurs, accélérer les interventions et sécuriser la gestion des dossiers sensibles.

**Équipe** : Massyle, Eric, Chrysler, Michael

---

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

---

## Démarrer le projet

**Tout avec Docker** (rien d'autre à installer) :

```bash
docker compose up --build
```

Puis ouvrir http://localhost:8080 (Swagger : http://localhost:8080/api-docs). Au premier démarrage, l'API crée les tables et insère les données de départ.

**En développement** (rechargement à chaque modification) :

```bash
docker compose up -d postgres        # la base seulement, sur localhost:5432
cd backend  && npm install && npm run dev
cd frontend && npm install && npm run dev   # http://localhost:5173
```

Les valeurs par défaut suffisent en local ; pour les changer, copier `.env.example` en `.env` à la racine.

**Sur un serveur** : les images sont publiées sur ghcr.io par la CI à chaque push sur `main`. Voir `deploy/compose.yml` et `deploy/.env.example`.

---

## Pousser sur `main`

Un hook git (`.githooks/pre-push`) vérifie chaque push vers `main`. Il s'active tout seul au premier `npm install` (à la racine, dans `backend/` ou dans `frontend/`).

Le push est **refusé** si :

- `main` n'est pas à jour avec GitHub → faire `git pull`, vérifier, puis `git push` ;
- le push réécrit l'historique (`--force`, `--force-with-lease`) ;
- il reste des modifications non commitées dans `backend/`, `frontend/` ou `scripts/` ;
- un test du backend échoue, le serveur ne démarre pas (PostgreSQL doit tourner) ou le frontend ne compile pas.

Pour lancer la même vérification sans pousser : `npm run verifier` à la racine. La CI GitHub (`.github/workflows/ci.yml`) refait ces vérifications à chaque push.
