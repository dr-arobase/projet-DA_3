# Risques — CrimeTracker

| # | Risque | Probabilité | Impact | Signal d'alerte | Mesure d'atténuation |
|---|---|---|---|---|---|
| 1 | **Socket.IO inconnu de l'équipe** | Élevée | Élevé | Aucun prototype fonctionnel de diffusion d'événement avant le milieu du sprint 2 | Faire une preuve de concept Socket.IO isolée (serveur Node + deux clients) dès la semaine 1 du sprint 1, hors application. Si au milieu du sprint 2 on n'arrive pas à diffuser un événement de bout en bout, on bascule sur un rafraîchissement automatique toutes les 5 secondes (polling) |
| 2 | **Portée trop large pour 10 semaines** | Moyenne | Élevé | Fin du sprint 1 avec moins de 60 % des récits terminés | L'ordre d'abandon est défini (voir `04-sprints.md`). Au sprint 2, si on a du retard, on coupe les `Should` avant de toucher aux `Must`. On ne discute pas — l'ordre est écrit |
| 3 | **Gestion de la concurrence sous-estimée** | Moyenne | Moyen | Au sprint 3, le mécanisme de verrouillage optimiste n'est pas fonctionnel après 3 jours de travail | Implémenter la logique de `version` dès le sprint 1 (le champ est dans le schéma), même si on ne l'exploite pas encore côté client. Écrire un test d'intégration simulant deux requêtes simultanées dès que la route PATCH est créée |
| 4 | **Problèmes de déploiement en fin de session** | Moyenne | Moyen | À la mi-sprint 3, aucun essai de déploiement n'a encore eu lieu | Tester un déploiement de l'image Docker sur la cible réelle (serveur département ou Render) dès la fin du sprint 2, même avec une version incomplète. Ne pas laisser le déploiement à la dernière semaine |
| 5 | **Inégalité de contribution au sein de l'équipe** | Faible | Élevé | Un membre sans commit ou ticket fermé depuis plus d'une semaine | Mêlée quotidienne obligatoire avec mise à jour du ticket. Le Scrum Master du sprint signale le problème en rétro si un membre est bloqué plus de deux jours. Les contributions individuelles sont documentées dans `05-equipe.md` à chaque sprint |

---

## Suivi à la fin du sprint 1

### Risques qui se sont matérialisés

| # | Risque | Ce qui s'est passé | Ce qu'on fait |
|---|---|---|---|
| 2 | **Portée trop large** (en partie) | Le backend du registre était complet et testé tôt, mais les écrans du registre (#4 à #9) n'ont été écrits que le 2 octobre, à quatre jours de la remise. Les sept récits ont finalement été livrés, sans recourir à l'ordre d'abandon, mais au prix d'une grande PR de fin de sprint (#35) et de travail hors sprint (temps réel, profil) fait avant les écrans engagés. | Au sprint 2, on planifie sur la vélocité réelle (19 points, voir `04-sprints.md`) et on termine les récits engagés, écran compris, avant tout ajout non engagé. |
| 5 | **Inégalité de contribution** (en partie) | Le travail est inégalement visible dans `main` : Eric n'a été responsable d'aucun récit du sprint 1, et sa PR (#22) n'est pas fusionnée; Chrysler a livré l'essentiel du backend en quelques gros commits, sans PR. | Tableau des contributions dans `05-equipe.md`. Au sprint 2, chaque membre est responsable d'au moins un récit dès la planification et livre par des PR revues. |

### Risques qui ont disparu ou diminué

| # | Risque | Pourquoi |
|---|---|---|
| 1 | **Socket.IO inconnu de l'équipe** | **Levé.** Socket.IO fonctionne de bout en bout dès le sprint 1 : connexion authentifiée par le cookie de session, diffusion des ajouts, changements de statut, retraits et alertes, liste de présence. Le tableau de bord se met à jour sans recharger la page, et des tests automatisés couvrent les événements. Le repli vers le polling n'est plus nécessaire. |
| 3 | **Concurrence sous-estimée** | **Diminué.** Le verrouillage optimiste est déjà en place côté serveur : un déclencheur PostgreSQL incrémente `version`, et `PATCH /api/criminals/:id/status` répond `409` avec l'état actuel en cas de conflit. Le frontend affiche le conflit sur la fiche d'un dossier, et des tests (routes et intégration PostgreSQL) vérifient qu'une version périmée reçoit `409`. |
| 4 | **Déploiement en fin de session** | **Diminué.** L'application démarre entièrement avec `docker compose up`, la CI construit et publie les images sur ghcr.io à chaque poussée sur `main`, et `deploy/compose.yml` est prêt pour un serveur. Il reste à choisir le serveur et à faire un premier déploiement réel. |

### Nouveaux risques

| # | Risque | Probabilité | Impact | Signal d'alerte | Mesure d'atténuation |
|---|---|---|---|---|---|
| 6 | **Travail fusionné sans revue** : la définition de « terminé » n'est pas appliquée (poussées directes sur `main`, PR non revues) | Élevée | Élevé | Un commit arrive sur `main` sans PR approuvée | `main` est protégée sur GitHub depuis le 2 octobre (ticket #28) : PR obligatoire et les deux vérifications de la CI vertes, administrateurs compris. Depuis le 6 octobre, GitHub n'exige plus d'approbation : la revue par un coéquipier reste une règle d'équipe, à respecter sans contrainte technique. Le hook `pre-push` bloque déjà un push qui casse les tests, le serveur ou le build. |
| 7 | **Frontend en retard sur le backend** : les routes existent mais les écrans manquent, alors que l'alpha est jugée dans le navigateur | Élevée | Élevé | Une route du backend terminée depuis plus d'une semaine sans écran | Un récit n'est terminé que si son écran fonctionne; chaque récit est découpé en une tâche backend et une tâche frontend, avec un responsable chacune. |
| 8 | **Conflits de fusion** : plusieurs branches longues touchent les mêmes fichiers (`app.js`, routes, `README`) | Moyenne | Moyen | Une branche a plus de 3 jours sans être fusionnée | Petites PR, une par ticket, fusionnées rapidement; `git pull` avant de commencer à travailler. |
| 9 | **Modification du schéma d'une base existante** : `schema.sql` ne s'applique qu'à une base vide (voir décision 7 de `03-conception.md`) | Moyenne | Moyen | Une colonne ajoutée fonctionne sur un clone neuf mais plante sur la base d'un coéquipier | Chaque colonne ajoutée est aussi ajoutée au démarrage (`ADD COLUMN IF NOT EXISTS`); passer à un outil de migration si le schéma change souvent. |
