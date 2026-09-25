# Plan de travail de l'équipe — Sprint 1

Ce dossier explique comment terminer le sprint 1 et remplir la rétrospective. Le fichier officiel à remettre est `../sprint-1.md`.

## Objectif du sprint

Livrer une version alpha utilisable de CrimeTracker :

- l'application démarre avec Docker à partir d'un clone neuf;
- la base de données est créée automatiquement et conserve les données;
- les récits engagés fonctionnent de bout en bout;
- les tests automatisés s'exécutent dans GitHub Actions;
- les éléments simulés sont indiqués dans l'application et dans le README.

## Répartition des responsabilités

Chaque personne est responsable d'une partie, mais toute l'équipe doit relire le résultat final et être capable de l'expliquer.

| Personne | Partie principale | Tâches à réaliser | Preuves à laisser |
|---|---|---|---|
| **Massyle** | `docs/02-backlog.md` et suivi produit | Vérifier l'ordre des récits; confirmer les récits engagés pour le sprint 1; vérifier que chaque récit a une priorité, une estimation, un responsable et des critères d'acceptation; mettre à jour les états GitHub | Issues à jour, responsables visibles, décisions notées dans le journal |
| **Eric** | `docs/04-sprints.md` et coordination | Confirmer l'objectif du sprint; calculer la capacité; répartir les points; noter l'ordre d'abandon; organiser les mêlées, la revue et la rétrospective | Plan de sprint daté, journal de chaque bloc, compte rendu de rétrospective |
| **Chrysler** | Tests et validation fonctionnelle | Vérifier les critères d'acceptation; préparer les cas heureux et les cas d'erreur; exécuter les tests; vérifier que la CI est verte; contrôler le démarrage Docker | Résultats de tests, commentaires de revue, tickets validés |
| **Michael** | Documentation et contrôle final | Vérifier le README, les comptes de démonstration, les éléments simulés, `docs/06-risques.md` et la checklist finale; vérifier les maquettes et la cohérence entre documentation et application | Corrections documentées, checklist remplie, revue finale |

## Tâches communes obligatoires

1. Chaque membre choisit au moins un récit et devient son responsable.
2. Chaque membre travaille depuis sa propre branche : `feature/<ticket>-<description>` ou `fix/<ticket>-<description>`.
3. Chaque changement passe par une demande de tirage relue par un autre membre.
4. Chaque récit terminé doit satisfaire la définition de « terminé » dans `docs/05-equipe.md`.
5. Chaque bloc de cours doit laisser une entrée dans `docs/journal.md`.
6. Les tickets GitHub doivent rester à jour : responsable, état, priorité et raison d'un abandon.
7. Avant la remise, toute l'équipe relit le README, les documents, les tests et le fonctionnement Docker.

## Ce que chacun doit faire

### Massyle — backlog et produit

- Confirmer les récits réellement livrables dans l'alpha.
- Retirer de l'engagement ce qui ne peut pas être terminé, en respectant l'ordre d'abandon.
- Vérifier que les récits du sprint 1 ont des critères observables, y compris les erreurs importantes.
- Mettre à jour le board GitHub après chaque décision.

### Eric — sprint et coordination

- Animer une mêlée au début de chaque bloc : fait, prochain travail, blocage.
- Vérifier l'avancement des points et décider rapidement quoi abandonner si nécessaire.
- Préparer la démonstration de l'alpha.
- Diriger la rétrospective de 30 minutes, sans écrire les réponses à la place des autres.

### Chrysler — tests

- Tester chaque parcours engagé du navigateur à la base de données et retour.
- Tester les champs vides, les valeurs invalides et les pages non autorisées.
- Vérifier que les tests deviennent rouges lorsqu'un comportement est cassé.
- Vérifier le résultat de GitHub Actions après chaque fusion.

### Michael — documents et contrôle final

- Vérifier que le README contient la commande Docker, l'adresse, la commande de test, les comptes de démonstration et les simulations.
- Comparer les issues, `02-backlog.md`, `04-sprints.md` et `05-equipe.md` pour repérer les contradictions.
- Vérifier que les maquettes correspondent aux parcours livrés.
- Remplir la checklist de `../énoncé/4_verification.mdx` avec l'équipe.

## Déroulement de la rétrospective

Durée : 30 minutes, entre les quatre membres, à la fin du dernier bloc.

1. **Avant la rencontre** : chacun écrit une idée pour les trois questions : ce qui a bien fonctionné, ce qui a été difficile, ce qu'il faut améliorer.
2. **10 minutes** : chacun partage ses observations sans chercher un responsable à blâmer.
3. **10 minutes** : l'équipe choisit un ou deux problèmes prioritaires et cherche une amélioration réaliste.
4. **10 minutes** : l'équipe choisit des actions précises, un responsable et une échéance.
5. **Après la rencontre** : Eric reporte la discussion dans `../sprint-1.md`; les autres relisent et approuvent.

Le compte rendu officiel doit contenir :

- la date;
- les participants;
- ce qui a bien fonctionné;
- ce qui a été difficile;
- ce qui doit être amélioré;
- au moins une action concrète avec un responsable et une échéance;
- le bilan des récits réalisés, des points livrés et des écarts.

## Exemple d'actions concrètes

À adapter à votre situation réelle, sans inventer les résultats :

| Problème observé | Action pour le sprint 2 | Responsable | Échéance |
|---|---|---|---|
| Les tickets ne sont pas toujours mis à jour après le travail | Mettre à jour le ticket à la fin de chaque bloc | Massyle | Chaque bloc du sprint 2 |
| Les tests arrivent trop tard | Écrire les tests avant la revue de la fonctionnalité | Chrysler | Chaque nouvelle PR |
| Les blocages sont signalés tard | Ajouter les blocages à la mêlée et au journal le jour même | Eric | Dès le prochain bloc |
| La documentation diverge du code | Relire le README après chaque changement important | Michael | Avant chaque fusion |

Ne copiez pas automatiquement cet exemple dans la rétrospective : remplacez-le par ce que l'équipe a réellement constaté.

## Ordre de finalisation

1. Massyle confirme le backlog et les récits engagés.
2. Eric confirme le plan, la capacité et les responsables.
3. Chrysler vérifie les tests et les parcours.
4. Michael vérifie la documentation et la checklist.
5. Les quatre membres font une relecture croisée.
6. Eric complète `docs/retrospectives/sprint-1.md`.
7. L'équipe committe et pousse les changements après validation commune.
