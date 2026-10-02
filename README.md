# CrimeTracker

CrimeTracker est une application web dédiée aux policiers pour centraliser le registre des personnes recherchées et améliorer la coordination sur le terrain. Elle permet de consulter, mettre à jour et diffuser les informations rapidement, avec une visibilité en temps réel pour tous les effectifs connectés. L'objectif est de réduire les erreurs, accélérer les interventions et sécuriser la gestion des dossiers sensibles.

**Équipe** : Massyle, Eric, Chrysler, Michael

---

## Démarrer l'application

Seul **Docker** est nécessaire. Depuis un clone neuf :

```bash
docker compose up --build
```

Puis ouvrir **http://localhost:8080**.

- Au premier démarrage, l'API crée les tables et insère les données de démonstration (`backend/serveur/database/schema.sql` et `seed.sql`).
- Les données vivent dans un volume Docker : elles **survivent** à `docker compose down` et à un redémarrage. Pour repartir de zéro : `docker compose down -v`.
- La documentation de l'API (Swagger) est sur http://localhost:8080/api-docs.
- Les valeurs par défaut suffisent en local. Pour les changer, copier `.env.example` en `.env` à la racine.

## Comptes de démonstration

Un compte par rôle. Le mot de passe est le même pour tous : **`Alpha2026!`**

| Matricule | Nom | Rôle | Grade |
|---|---|---|---|
| `PO-001` | Massyle Riahi | Direction | Directeur général |
| `SM-002` | Eric Tremblay | Superviseur | Lieutenant |
| `PL-003` | Chrysler Jean | Policier | Sergent (autres fonctions) |
| `PL-004` | Michael Fortin | Policier | Sergent (autres fonctions) |

**Compte rapide de l'équipe** (tests en local) : matricule **`1`**, mot de passe **`2`**, rôle Direction. Il est créé avec les autres dans une base neuve. Pour l'ajouter à une base déjà créée, sans rien effacer :

```bash
docker compose exec api node scripts/compte-equipe.js     # avec Docker
cd backend && node scripts/compte-equipe.js               # sans Docker (npm run dev)
```

> Ces comptes ne sont créés que dans une base **vide**. Si votre base a été créée avant l'ajout de ces mots de passe, réinitialisez-la (`docker compose down -v`) ou, dans `backend/`, lancez `node scripts/set-passwords.js Alpha2026!` (change le mot de passe de **tous** les comptes).

---

## Développer

Il faut Node.js (version LTS, voir `.nvmrc`) et Docker pour la base de données.

```bash
npm run dev
```

À la racine, cette commande installe les dépendances si elles manquent, démarre PostgreSQL dans Docker, puis lance le backend et le frontend côte à côte avec rechargement automatique :

- application : http://localhost:5173
- API : http://localhost:3000 (Swagger : `/api-docs`)

`Ctrl+C` arrête les deux. Dans VS Code, on peut aussi cliquer sur **▷ Run Script** au-dessus du script `dev` dans `package.json`.

Pour lancer une seule partie : `npm run dev:backend` ou `npm run dev:frontend`.

## Tests

```bash
cd backend
npm test
```

Les tests du backend (Jest + Supertest) simulent la base de données : PostgreSQL n'est pas nécessaire. Les tests d'intégration `tests/integration/` s'exécutent seulement si une base est disponible.

La **CI GitHub Actions** (`.github/workflows/ci.yml`) s'exécute à chaque poussée. Elle lance les tests, démarre réellement le serveur, compile le frontend, puis démarre la pile complète avec `docker compose up` et vérifie le frontend, l'API et Swagger à travers nginx.

Pour lancer la même vérification en local : `npm run verifier` à la racine.

---

## Ce qui est simulé dans l'alpha

Ces éléments sont visibles dans l'interface mais ne sont pas encore réels. Chacun est aussi signalé **à l'écran** : étiquette « Chiffres de démonstration », mention « à venir », ou « À venir » dans le menu.

| Élément | Où | Ce qui le remplacera | Sprint |
|---|---|---|---|
| Chiffres « 128 fiches actives, 58 agents connectés, 6 alertes » (étiquette « Chiffres de démonstration ») | Page de connexion | Les vrais compteurs, lus dans l'API | 3 (statistiques) |
| « Mot de passe oublié ? (à venir) » | Page de connexion | Réinitialisation par un superviseur | 2 |
| « Authentification à deux facteurs : à venir » | Page de connexion | Authentification externe (OAuth 2 / OIDC) | 2 |
| Pages Alertes, Communiqués, Utilisateurs (« À venir » dans le menu et sur « Diffuser un communiqué ») | Menu latéral, tableau de bord | Diffusion d'alertes, gestion des comptes | 2 |
| Pages Annuaire, Statistiques (« À venir » dans le menu) | Menu latéral | Agents connectés, statistiques globales | 3 |
| Pages Messagerie, Carte (« À venir » dans le menu) | Menu latéral | Hors portée de l'alpha (récits *Could*) | — |

Le reste est réel : le tableau de bord (compteurs, activité récente, dernier communiqué) et le registre des personnes recherchées (liste, recherche, fiche, ajout, statut, retrait) lisent et écrivent dans la base, et se mettent à jour en temps réel (Socket.IO).

---

## Structure du dépôt

| Dossier | Contenu |
|---|---|
| `backend/` | API Express + Socket.IO, PostgreSQL (`serveur/src`), schéma et données (`serveur/database`), tests (`serveur/tests`) |
| `frontend/` | Application React (Vite), servie par nginx en production |
| `docs/` | Vision, backlog, conception, sprints, équipe, risques, journal, maquettes, rétrospectives |
| `deploy/` | Déploiement sur un serveur avec les images publiées sur ghcr.io |
| `scripts/` | `demarrer.mjs` (`npm run dev`) et `verifier-avant-push.mjs` (`npm run verifier`) |

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

## Pousser sur `main`

Un hook git (`.githooks/pre-push`) vérifie chaque push vers `main`. Il s'active tout seul au premier `npm install` (à la racine, dans `backend/` ou dans `frontend/`).

Le push est **refusé** si :

- `main` n'est pas à jour avec GitHub → faire `git pull`, vérifier, puis `git push` ;
- le push réécrit l'historique (`--force`, `--force-with-lease`) ;
- il reste des modifications non commitées dans `backend/`, `frontend/` ou `scripts/` ;
- un test du backend échoue, le serveur ne démarre pas (PostgreSQL doit tourner) ou le frontend ne compile pas.
