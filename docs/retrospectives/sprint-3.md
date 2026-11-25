# Rétrospective du sprint 3

## Date

Mercredi 25 novembre 2026, deux jours avant le gel des fonctionnalités (vendredi 27 novembre). La remise de `finale-v1` est le jeudi 3 décembre, 23 h 59.

## Participants

- Massyle (Product Owner)
- Eric (Scrum Master)
- Chrysler
- Michael

Chaque membre rédige sa partie à partir de son propre historique GitHub, comme au sprint 2. Celle de Massyle est ci-dessous; les autres restent à écrire avant la remise.

## Bilan des actions du sprint 2

| Action promise au sprint 2 | Résultat au sprint 3 |
|---|---|
| Une revue par PR, avec un commentaire concret | **Pas tenue.** Les 17 PR de Massyle fusionnées au sprint 3 (#161 à #170, #201, #203, #224 à #226, #245, #248) n'ont aucune revue enregistrée sur GitHub. |
| Corriger la limite de tentatives de connexion (échecs seulement, par adresse IP et matricule) | **Pas faite.** Tâche E2 (Eric, #89), toujours ouverte : un collègue du même poste peut encore être bloqué. |
| Étiquette de remise posée avant l'échéance | **À venir.** `beta-v1` avait été posée le 31 octobre, deux jours après l'échéance; `finale-v1` se pose au plus tard le 3 décembre. |
| Terminer la direction de design E sur toutes les pages | **Tenue.** Le 25 novembre, 22 pages vérifiées à 375 px sur le site en ligne : aucune ne défile sur le côté. |

## Partie de Massyle (Product Owner)

Établie à partir de l'historique GitHub du 3 au 25 novembre : 17 PR fusionnées, 33 commits dans `main`, 3 PR de coéquipier revues (#195, #196, #197).

### Ce qui a bien fonctionné

- L'engagement du sprint (26 points, R1 à R6) et son ordre d'abandon ont été écrits le 3 novembre, au début du sprint, et l'avancement a été noté dans `04-sprints.md` (10 points restants le 20 novembre).
- Le plan de corrections a été fusionné le 4 novembre (#161 à #170) : relais TURN, Swagger complet, 404 en JSON, SQLite retiré, verrouillage optimiste, journal d'audit, textes invisibles refusés.
- Les demandes du Product Owner sont devenues des tickets, avec leurs critères et leurs points (#202, #219 à #223).
- La double authentification par application, pour tous les comptes, a été livrée avec ses codes de secours et ses tests (#225).
- Le site en ligne est plus solide : HSTS et CSP (#224, #245), sauvegarde quotidienne avec vérification de la restauration, journaux limités, surveillance toutes les 5 minutes (#245).
- Le plan de l'équipe en ligne, vérifié contre `main` à chaque point de contrôle, a montré à chacun où il en était, avec la preuve de chaque tâche terminée.
- Un essai du site en ligne le 25 novembre a trouvé de vrais défauts (carte grise à la première visite, faux « 0 » sur l'accueil, page Utilisateurs trop haute), corrigés le jour même (#248).

### Ce qui a été difficile

- **Encore aucune revue sur mes PR.** C'est l'action numéro un du sprint 2, et je ne l'ai pas tenue : j'ai fusionné moi-même, souvent quelques minutes après l'ouverture.
- Les réglages à faire sur la machine Azure n'ont pas suivi le code : Swagger est encore ouvert en ligne (#194), les données d'essai sont encore là (#209), la mémoire est presque pleine (#185) et le relais TURN n'est pas configuré (#188). Résultat : un appel entre la 4G et un Wi-Fi ne passe pas encore.
- La connexion GitHub laisse entrer n'importe quel compte, comme l'exige l'énoncé : deux inconnus sont devenus policiers en ligne.
- Le travail de l'équipe a été inégal : selon l'historique GitHub, Eric n'a fait aucun commit de code depuis le 1er novembre (seulement des approbations de PR), et Michael aucun depuis le 10 novembre.

### Ce que je veux améliorer

- Ne plus fusionner mes propres PR : attendre l'approbation d'un coéquipier, avec un commentaire.
- Faire les réglages d'Azure le jour même où le code qui en dépend est fusionné, avec la liste de `deploy/EXPLOITATION.md`.
- Parler à l'équipe dès qu'un membre n'a rien poussé depuis une semaine, plutôt qu'au point de contrôle suivant.

### Actions pour la fin du sprint

| Action | Comment on saura qu'elle est faite |
|---|---|
| Une approbation de coéquipier sur chaque PR d'ici la remise | Chaque PR fusionnée après le 25 novembre a au moins une revue enregistrée sur GitHub |
| Appliquer `deploy/EXPLOITATION.md` sur Azure (Swagger, données de démonstration, sauvegarde, mémoire, relais TURN) | `/api-docs/` répond 404 en ligne, un appel 4G vers Wi-Fi est noté réussi dans #188 |
| Poser `finale-v1` avant l'échéance | `git ls-remote --tags origin` montre `finale-v1` au plus tard le 3 décembre, sur un `main` dont la CI est verte |

## Partie d'Eric (Scrum Master)

À rédiger par Eric, à partir de son historique GitHub.

## Partie de Chrysler

À rédiger par Chrysler, à partir de son historique GitHub.

## Partie de Michael

À rédiger par Michael, à partir de son historique GitHub.
