# Base de données — CrimeTracker

Ce dossier contient le schéma PostgreSQL du projet, dérivé du modèle de données décrit dans [../docs/03-conception.md](../docs/03-conception.md).

## Contenu

| Fichier | Rôle |
|---|---|
| `schema.sql` | Crée les types énumérés, les tables et les index (`app_user`, `criminal`, `sighting`, `alert`, `audit_log`) |
| `seed.sql` | Données d'exemple pour tester en local (mots de passe fictifs, à ne jamais utiliser en production) |
| `docker-compose.yml` | Lance un conteneur PostgreSQL prêt à recevoir le schéma |

## Démarrer la base avec Docker

```bash
cd database
docker compose up -d
```

Cela démarre PostgreSQL sur le port `5432` avec :
- base : `crimetracker`
- utilisateur : `crimetracker`
- mot de passe : `crimetracker`

## Appliquer le schéma

```bash
docker exec -i crimetracker-db psql -U crimetracker -d crimetracker < schema.sql
docker exec -i crimetracker-db psql -U crimetracker -d crimetracker < seed.sql
```

## Correspondance avec la conception

- `app_user` correspond à l'entité `USER` (le nom `app_user` évite le mot réservé `user` en SQL).
- `criminal.version` est incrémenté automatiquement par un déclencheur (`trg_bump_criminal_version`) à chaque `UPDATE`, ce qui implémente le verrouillage optimiste décrit dans la Décision 2 de [03-conception.md](../docs/03-conception.md).
- Les statuts (`recherche`, `capture`, `libere`) et les rôles (`policier`, `superviseur`, `direction`) reprennent exactement les valeurs du diagramme entité-association.

## À faire au sprint 1

- Brancher le cadriciel (React Router v7) sur cette base via un client PostgreSQL (`pg` ou un ORM).
- Écrire les migrations si le schéma évolue, plutôt que de modifier `schema.sql` directement une fois le sprint 1 commencé.
- Remplacer les mots de passe fictifs de `seed.sql` par des hachages générés (bcrypt/argon2) avant tout usage réel.
