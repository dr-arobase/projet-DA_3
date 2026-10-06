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

**Bloc 1 — vendredi 11 septembre 2026 (15 h - 18 h)**
Présences : Massyle, Eric, Chrysler, Michael
Ce qui a avancé :
•   Lancement du Sprint 1 et planification de l'incrément alpha.
•   Création des tickets GitHub (issues #1 à #19) à partir des récits d'utilisateurs.
•   Initialisation de la structure du projet avec Docker, Node.js (Express), PostgreSQL et React.
Ce qui bloque : Aucun blocage majeur signalé.
Décisions prises : Découpage du travail selon les rôles définis dans l'équipe : Massyle au frontend/CI, Chrysler à la BD/backend, Michael aux formulaires et intégration, Eric à la documentation et aux tests.


**Bloc 2 — mercredi 16 septembre 2026 (8 h - 11 h)**
Présences : Massyle, Eric, Chrysler, Michael
Ce qui a avancé :
•   Mise en place de la base de données PostgreSQL et création du schéma initial.
•   Création des routes d'authentification (`POST /api/auth/login`) et intégration du hachage de mot de passe avec bcrypt.
•   Configuration de la chaîne d'intégration continue (.github/workflows/ci.yml) pour exécuter les tests à chaque push.
Ce qui bloque : Ajustement de la configuration Docker pour assurer la persistance des données PostgreSQL entre les redémarrages.
Décisions prises : Utilisation d'un volume Docker dédié (`postgres_data`) pour conserver la base de données.


**Bloc 3 — vendredi 18 septembre 2026 (15 h - 18 h)**
Présences : Massyle, Eric, Chrysler, Michael
Ce qui a avancé :
•   Développement des endpoints REST pour les criminels (`/api/criminals`).
•   Création des maquettes d'interface et intégration initiale du tableau de bord frontend.
•   Rédaction des tests unitaires et d'intégration pour le backend (165 tests validés).
Ce qui bloque : Les comptes de démo dans `seed.sql` utilisent des mots de passe fictifs non hachés, empêchant la connexion effective.
Décisions prises : Génération et intégration de vrais hachages bcrypt dans le script de démarrage `seed.sql` pour les comptes de chaque rôle.


**Bloc 4 — mercredi 23 septembre 2026 (8 h - 11 h)**
Présences : Massyle, Eric, Chrysler, Michael
Ce qui a avancé :
•   Avancement sur le composant frontend d'affichage des listes et la pagination.
•   Implémentation des contrôleurs backend pour le changement de statut d'un dossier (#8) et le retrait par un superviseur (#7).
Ce qui bloque : Retard accumulé sur le suivi administratif GitHub (tickets non assignés, absences de Pull Requests fermant les issues).
Décisions prises : Prioriser le code fonctionnel et procéder à la régularisation du suivi GitHub avant la remise de l'alpha.


**Bloc 5 — vendredi 25 septembre 2026 (15 h - 18 h)**
Présences : Massyle, Eric, Chrysler, Michael
Ce qui a avancé :
•   Intégration du formulaire d'ajout d'un dossier criminel côté frontend (Michael, #6).
•   Mise en place de la recherche par nom et du filtre par statut dans la liste des criminels (Massyle, #4, #9).
•   Développement de la page de profil d'un dossier et des actions de mise à jour (Chrysler, #5).
Ce qui bloque : La recherche globale et la cloche de notification restent incomplètes côté frontend.
Décisions prises : Afficher un bandeau « Simulé » explicite sur les éléments non raccordés au backend conformément aux consignes de l'alpha.


**Bloc 6 — jeudi 1er octobre 2026 (Jour de remise Alpha)**
Présences : Massyle, Eric, Chrysler, Michael
Ce qui a avancé :
•   Rédaction du `README.md` principal à la racine du dépôt décrivant le démarrage Docker, les comptes de démo et les éléments simulés (Massyle).
•   Ménage du dépôt et replacement des maquettes sous `docs/maquettes/` (Michael).
•   Tests de qualification complets sur clone neuf avec `docker compose up --build` (Michael).
•   Tenue de la rétrospective du Sprint 1 (`docs/retrospectives/sprint-1.md`), rédaction du bilan (`docs/04-sprints.md`), et mise à jour de la matrice de risques et des contributions (Eric, Chrysler).
•   Publication de la version alpha via le tag `alpha-v1` sur `main` (Massyle).
Ce qui bloque : Constat que les entrées de journal des blocs passés du Sprint 1 n'ont pas été commises au fur et à mesure.
Décisions prises : Ajout rétrospectif et daté honnêtement des 6 entrées du Sprint 1 dans `docs/journal.md`, avec mention explicite au professeur dans le bilan de sprint.