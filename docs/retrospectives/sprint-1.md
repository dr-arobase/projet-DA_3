# Rétrospective du sprint 1

## Date

Mardi 6 octobre 2026, avant la pose de l'étiquette `alpha-v1`.

## Participants

- Massyle (Product Owner)
- Eric (Scrum Master, anime la rétrospective)
- Chrysler
- Michael

## Ce qui a bien fonctionné

- Le backend a avancé vite : toutes les routes du registre, l'authentification avec mot de passe haché, les rôles et même le temps réel (Socket.IO) fonctionnent et sont testés.
- L'application démarre avec une seule commande (`docker compose up --build`) et la CI vérifie à chaque poussée les tests, le démarrage du serveur, le build du frontend et la pile Docker complète.
- Les sept récits engagés (24 points) fonctionnent de bout en bout dans le navigateur; aucun n'a dû être abandonné.
- Une fois `main` protégée, les PR ont été revues avant la fusion (#35, #36, #37, #40).

## Ce qui a été difficile

- Le frontend a pris du retard sur le backend : les écrans du registre n'ont été écrits que le 2 octobre, livrés dans une seule grande PR (#35), difficile à revoir.
- Jusqu'au 30 septembre, le travail était poussé directement sur `main`, sans PR ni revue : la définition de « terminé » n'était pas appliquée, et le récit #3 ne compte pas comme livré.
- Le journal n'a pas été commis le jour de chaque bloc; il a été écrit après coup.
- La répartition n'a pas été équilibrée : Eric n'a été responsable d'aucun récit, et des branches (#22, #23, #34) sont restées longtemps ouvertes avant d'être fermées.
- Les tickets GitHub n'ont pas changé d'état au fil du sprint, mais surtout à la fin.

## Ce que nous voulons améliorer

- Découper chaque récit en une tâche backend et une tâche frontend, et ne pas commencer un nouveau récit tant que l'écran du précédent n'est pas fait.
- Une PR par ticket, petite, revue avec au moins un commentaire concret.
- Écrire l'entrée du journal à la fin de chaque bloc, pendant la séance.
- Déplacer les tickets dans le Project au fur et à mesure.

## Actions décidées

| Action | Responsable | Échéance |
|---|---|---|
| Écrire et commettre l'entrée du journal à la fin de chaque bloc de cours | Michael | Chaque bloc du sprint 2, dès le 8 octobre |
| À la planification du sprint 2, chaque membre est responsable d'au moins un récit, découpé en tâche backend et tâche frontend | Eric | Planification du sprint 2 (8 octobre) |
| Revoir chaque PR dans les 24 h avec au moins un commentaire concret; une PR par ticket | Chrysler | Toute la durée du sprint 2 |
| Mettre à jour l'état des tickets du Project à chaque mêlée | Massyle | Chaque bloc du sprint 2 |

## Bilan du sprint

24 points engagés, 19 livrés selon la définition de « terminé » (#4 à #9), vélocité retenue pour le sprint 2 : 19 points. Le détail est dans [`04-sprints.md`](../04-sprints.md#bilan-du-sprint-1).
