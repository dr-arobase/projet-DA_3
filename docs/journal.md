**JOURNAL DE BORD — SPRINT 0**
Projet : CrimeTracker

**Bloc 1 — vendredi 21 août 2026**
Présences : Massyle, Eric, Chrysler, Michael
Ce qui a avancé :
•	Présentation de l’énoncé par le professeur.
•	Formation de l’équipe.
•	Exploration de différentes pistes de sujets en groupe.
Ce qui bloque : Aucun blocage signalé.
Décisions prises : Piste retenue pour le sujet : une application de gestion des avis de recherche destinée aux corps policiers nationaux.


**Bloc 2 — mercredi 26 août 2026**
Présences : Massyle, Eric, Chrysler, Michael
Ce qui a avancé :
•	Approfondissement du concept de CrimeTracker.
•	Identification des deux rôles principaux : agent et superviseur.
•	Discussion autour de la fonctionnalité en temps réel : le tableau de bord en direct a été retenu comme élément central de l’application.
•	Première réflexion sur la pile technologique : React Router v7, PostgreSQL et Socket.IO.
Ce qui bloque : Une hésitation subsistait entre Socket.IO et SSE pour la gestion du temps réel. La décision s’est finalement portée sur Socket.IO, notamment pour son fonctionnement bidirectionnel et parce que cette technologie est enseignée dans le cours.
Décisions prises : Nom de l’application : CrimeTracker. Pile technologique retenue : React Router v7, PostgreSQL, Docker, Socket.IO et GitHub Actions.


**Bloc 3 — vendredi 28 août 2026 (Point de contrôle 1)**
Présences : Massyle, Eric, Chrysler, Michael
Ce qui a avancé :
•	Présentation de l’argumentaire au professeur.
•	Début de la mise en place générale du projet et de l’organisation du travail.
•	Révision de la vision du projet et des fonctionnalités principales.
•	Poursuite de la préparation de la structure du site et des prochaines étapes de développement.
Ce qui bloque : Aucun blocage majeur signalé.
Décisions prises : Les décisions déjà présentes dans notre vision et notre backlog sont maintenues. L’objectif est maintenant de travailler activement sur le site et de respecter les délais. L’équipe souhaite réaliser un projet ambitieux tout en veillant à ce qu’il demeure réaliste et réalisable dans le temps disponible.


**Bloc 4 — mercredi 2 septembre 2026**
Présences : Massyle, Eric, Chrysler, Michael
Ce qui a avancé :
•	Poursuite de l’organisation du projet et préparation du travail à réaliser.
•	Configuration des comptes Trello pour faciliter la distribution et le suivi des tâches entre les membres de l’équipe.
•	Répartition initiale des tâches afin de mieux organiser le développement et le suivi de l’avancement.
Ce qui bloque : Aucun blocage majeur signalé.
Décisions prises : Trello est retenu comme outil d’organisation et de suivi des tâches. Les membres de l’équipe peuvent maintenant suivre leur travail respectif et mieux coordonner les prochaines étapes du projet.



**Bloc 5 — vendredi 4 septembre 2026 (Point de contrôle 2)**
Présences : Massyle, Eric, Chrysler, Michael
Ce qui a avancé :
•	Poursuite du développement et de l’organisation du projet.
•	Suivi des tâches distribuées dans Trello.
•	Vérification de l’avancement général du projet et ajustement des priorités au besoin.
Ce qui bloque : Aucun blocage majeur signalé.
Décisions prises : Maintien de l’organisation prévue et poursuite du développement afin de respecter les échéances du projet.



**Bloc 6 — mercredi 9 septembre 2026 (Remise)**
Présences : Massyle, Eric, Chrysler, Michael
Ce qui a avancé :
•	Finalisation du travail prévu pour le Sprint 0.
•	Vérification générale du projet et préparation de la remise.
•	Révision des éléments réalisés afin de s’assurer que le travail respecte les attentes du projet.
Ce qui bloque : Aucun blocage majeur signalé.
Décisions prises : Finalisation du Sprint 0 et remise du travail dans les délais prévus.


**JOURNAL DE BORD — SPRINT 1**

**Bloc 1 — mercredi 16 septembre 2026 (8 h - 11 h)**
Présences : Massyle, Eric, Chrysler, Michael
Ce qui a avancé :
•   Lancement officiel du Sprint 1 et cadrage des exigences pour la version Alpha.
•   Organisation des rôles et revue du backlog d'équipe.
•   Réflexion sur la structure initiale du projet et les priorités de développement.
Ce qui bloque : Aucun blocage majeur.
Décisions prises : Lancer le développement backend et la configuration de l'environnement dès le bloc suivant.


**Bloc 2 — vendredi 18 septembre 2026 (15 h - 18 h)**
Présences : Massyle, Eric, Chrysler, Michael
Ce qui a avancé :
•   Ajout du schéma PostgreSQL initial et du plan de rétrospective d'équipe (`dr-arobase`).
•   Mise en place de la documentation et création de la structure de base du backend (`MichaelLaurore`).
•   Configuration initiale des fichiers `Dockerfile` et `docker-compose.yml`.
Ce qui bloque : Nécessité d'aligner les routes d'authentification et la structure des criminels.
Décisions prises : Valider le schéma de base de données avant d'avancer sur les tests d'intégration.


**Bloc 3 — mercredi 23 septembre 2026 (8 h - 11 h)**
Présences : Massyle, Eric, Chrysler, Michael
Ce qui a avancé :
•   Mise en place de la chaîne CI avec GitHub Actions et tests continus (`Lenrics-01`).
•   Organisation de la structure backend et ajout des spécifications OpenAPI / Swagger (`dr-arobase`).
•   Développement initial des routes `dossier.js`, `auth.js` et `criminal.js` (`MichaelLaurore`).
•   Ajout du fichier `.gitignore` pour exclure les dépendances `node_modules` et fichiers de configuration locaux.
Ce qui bloque : Ajustements requis dans la CI (`ci.yml`) pour stabiliser l'exécution automatisée des tests.
Décisions prises : Poursuivre le développement des contrôleurs backend et valider la CI à chaque push.


**Bloc 4 — vendredi 25 septembre 2026 (15 h - 18 h)**
Présences : Massyle, Eric, Chrysler, Michael
Ce qui a avancé :
•   Configuration complète du serveur Node/Express (`app.js`, `server.js`, connexions DB et scripts npm).
•   Intégration de Swagger pour la documentation interactive de l'API.
•   Ajout des premiers tests d'intégration backend avec Jest et Supertest (`dr-arobase`).
•   Ajustements sur les endpoints de gestion des dossiers (`MichaelLaurore`).
Ce qui bloque : Résolution de conflits mineurs lors du déplacement du dossier `docs/` et dans le `README.md`.
Décisions prises : Finaliser les routes d'authentification et de gestion des criminels pour le début de la semaine suivante.


**Bloc 5 — mercredi 30 septembre 2026 (8 h - 11 h)**
Présences : Massyle, Eric, Chrysler, Michael
Ce qui a avancé :
•   Finalisation de l'authentification par session/cookie, gestion du temps réel via Socket.IO, rôles, utilisateurs, signalements et journaux d'audit (`nleukeu76`, `dr-arobase`).
•   Création du frontend React (page de connexion, tableau de bord, suivi en temps réel).
•   Ajout d'une suite complète de tests backend (Socket.IO, routes REST).
•   Conteneurisation complète de la stack avec `docker compose up` et verrouillage de la CI pour les déploiements.
Ce qui bloque : Retard accumulé dans la tenue au fil de l'eau du journal et l'attribution des tickets GitHub.
Décisions prises : Consacrer la fin de semaine à la création des pages frontend du registre et à la régularisation de la documentation.


**Bloc 6 — vendredi 2 octobre 2026 (15 h - 18 h — Remise)**
Présences : Massyle, Eric, Chrysler, Michael
Ce qui a avancé :
•   Création et intégration complète des pages frontend du registre : liste, fiche détaillée, ajout, changement de statut et retrait (`dr-arobase`, PR #35, tickets #4 à #9).
•   Mise en place de la recherche par nom, de l'affichage clair des éléments simulés et de la documentation du Sprint 1.
•   Ajout d'un compte de démo rapide de l'équipe (matricule 1, mot de passe 2) dans `seed.sql` (`dr-arobase`, PR #36, revue par `Lenrics-01`).
•   Revue finale des Pull Requests (#35, #36), fusion sur `main` et rédaction rétrospective du journal de bord.
Ce qui bloque : La saisie du journal n'ayant pas été faite au jour le jour lors des premiers blocs, les dates ont été régularisées de manière transparente et honnête.
Décisions prises : Apposer le tag `alpha-v1` sur le dernier commit validé par la CI et remettre la version alpha.


**Note — mardi 6 octobre 2026 (soir, avant la remise)**
Fusion de la PR #38 (bilan du sprint, contributions et risques) **sans approbation d'un coéquipier** : aucun coéquipier n'était disponible pour la revoir avant l'échéance de minuit. La protection de `main` a été désactivée le temps de cette fusion seulement, puis réactivée aussitôt. C'est l'exception prévue par nos règles (« sauf urgence documentée dans le journal »); la PR reste ouverte aux commentaires de l'équipe après coup.
