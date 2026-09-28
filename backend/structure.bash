#!/usr/bin/env bash

cat <<'TREE'
projet-DA_3-main/                         # Racine du projet CrimeTracker
├── database/                              # Base PostgreSQL et scripts de création
│   ├── docker-compose.yml                 # Démarre le conteneur PostgreSQL local
│   ├── schema.sql                         # Crée les tables, relations, types et index
│   ├── seed.sql                           # Ajoute des données de test locales
│   └── README.md                          # Explique comment lancer et initialiser la base
├── docs/                                  # Documents de conception et de suivi du projet
│   ├── 01-vision.md                       # Décrit le problème, les utilisateurs et la portée
│   ├── 02-backlog.md                      # Présente les épiques et les récits prioritaires
│   ├── 03-conception.md                   # Décrit les données, routes, maquettes et décisions
│   ├── 04-sprints.md                      # Planifie les objectifs et livrables des sprints
│   ├── 05-equipe.md                       # Définit les rôles, rituels et règles de travail
│   ├── 06-risques.md                      # Liste les risques, signaux et atténuations
│   ├── api.yaml                            # Décrit l'API avec le format OpenAPI
│   ├── journal.md                          # Conserve une trace de chaque bloc de travail
│   ├── maquettes/                          # Contient les maquettes des écrans clés
│   └── retrospectives/                     # Contient les bilans et actions des sprints
├── src/                                   # Code source du backend Express
│   ├── app.js                             # Configure Express, les routes et Swagger
│   ├── api-liste.txt                      # Inventaire lisible des API existantes et prévues
│   ├── swagger.json                       # Ancienne documentation OpenAPI JSON
│   ├── config/                            # Configuration des connexions et variables
│   │   └── db.js                          # Crée et exporte le pool de connexion PostgreSQL
│   ├── controllers/                       # Reçoit les requêtes et retourne les réponses HTTP
│   │   ├── alerts.controller.js           # Contrôle la création et la diffusion des alertes
│   │   ├── auditLogs.controller.js        # Contrôle la consultation des journaux d'audit
│   │   ├── auth.controller.js             # Contrôle la connexion et la déconnexion
│   │   ├── criminals.controller.js        # Contrôle les dossiers de personnes recherchées
│   │   ├── sightings.controller.js        # Contrôle les signalements de terrain
│   │   └── users.controller.js             # Contrôle les comptes et leurs statuts
│   ├── middleware/                        # Fonctions exécutées avant les contrôleurs
│   │   ├── auth.middleware.js              # Vérifie le jeton et l'identité connectée
│   │   ├── error.middleware.js             # Transforme les erreurs en réponses cohérentes
│   │   ├── rbac.middleware.js               # Vérifie les permissions selon le rôle
│   │   └── upload.middleware.js             # Valide les fichiers téléversés et leur taille
│   ├── models/                            # Accès aux tables et requêtes PostgreSQL
│   │   ├── alert.model.js                  # Requêtes sur la table alert
│   │   ├── auditLog.model.js               # Requêtes sur la table audit_log
│   │   ├── criminal.model.js               # Requêtes sur la table criminal et sa version
│   │   ├── sighting.model.js               # Requêtes sur la table sighting
│   │   └── user.model.js                   # Requêtes sur la table app_user
│   ├── routes/                            # Déclare les URL et méthodes HTTP de l'API
│   │   ├── alerts.routes.js                # Routes des alertes temps réel
│   │   ├── auditLogs.routes.js             # Routes du journal d'audit
│   │   ├── auth.js                         # Route actuelle de connexion
│   │   ├── auth.routes.js                  # Point d'entrée nommé des routes d'authentification
│   │   ├── criminals.js                    # Routes actuelles des dossiers criminels
│   │   ├── criminals.routes.js             # Point d'entrée nommé des dossiers criminels
│   │   ├── sightings.routes.js             # Routes des observations terrain
│   │   ├── users.routes.js                 # Routes de gestion des utilisateurs
│   │   └── dossier.js                      # Ancienne route à retirer ou migrer vers criminals
│   ├── services/                          # Logique métier réutilisable
│   │   ├── alerts.service.js               # Crée, enregistre et diffuse les alertes
│   │   ├── auditLogs.service.js             # Enregistre les actions sensibles
│   │   ├── auth.service.js                  # Gère bcrypt, sessions et JWT
│   │   ├── criminals.service.js             # Applique les règles métier des dossiers
│   │   ├── sightings.service.js             # Traite les signalements et leur historique
│   │   └── users.service.js                 # Gère les comptes, rôles et promotions
│   ├── sockets/                           # Communication temps réel Socket.IO
│   │   └── index.js                       # Enregistre les événements et connexions clients
│   ├── uploads/                           # Fichiers téléversés par l'application
│   │   ├── documents/                      # Documents associés aux dossiers
│   │   └── photos/                         # Photos des personnes recherchées
│   └── utils/                             # Fonctions communes sans logique métier
│       ├── jwt.js                          # Signe et vérifie les jetons JWT
│       ├── logger.js                       # Centralise les journaux du serveur
│       └── validators.js                   # Valide les données reçues par l'API
├── tests/                                 # Tests automatisés du backend
│   └── smoke.test.js                      # Vérifie que la structure et le serveur répondent
├── .env                                   # Variables locales, jamais à publier avec des secrets
├── .gitignore                             # Exclut node_modules et fichiers locaux
├── Dockerfile                             # Construit l'image du serveur Node.js
├── docker-compose.yml                     # Lance l'API et PostgreSQL ensemble
├── package.json                           # Dépendances et commandes npm du backend
├── package-lock.json                      # Versions exactes des dépendances installées
├── README.md                              # Point d'entrée et instructions générales
├── server.js                              # Démarre le serveur HTTP de production
└── structure.bash                         # Affiche cette structure et ses responsabilités
TREE
