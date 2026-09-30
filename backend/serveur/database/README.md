# Base de données — CrimeTracker

Schéma PostgreSQL du projet, dérivé du modèle de données décrit dans [docs/03-conception.md](../../../docs/03-conception.md).

| Fichier | Rôle |
|---|---|
| `schema.sql` | Types énumérés, tables (`app_user`, `criminal`, `sighting`, `alert`, `audit_log`), index et trigger de version |
| `seed.sql` | Comptes de démonstration et données d'exemple |

## Initialisation

Rien à lancer à la main : au démarrage, l'API exécute `schema.sql`, puis `seed.sql` si la table `app_user` est vide (voir `src/config/db-postgres.js`).

```bash
docker compose up -d postgres     # depuis la racine du dépôt
```

Base `crimetracker`, utilisateur `crimetracker`, mot de passe `crimetracker`, sur `localhost:5432`.

## Repartir d'une base vide

```bash
docker compose down -v            # supprime le volume : toutes les données sont perdues
docker compose up --build
```

## Consulter la base

```bash
docker exec -it crimetracker-db psql -U crimetracker -d crimetracker
```
