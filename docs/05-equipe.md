# Organisation de l'équipe — CrimeTracker

## Membres

| Prénom | Rôle Scrum Master |
|---|---|
| Massyle | Sprint 1 |
| Eric | Sprint 2 |
| Chrysler | Sprint 3 |
| Michael | *Product Owner collectif* (tout le monde, voir ci-dessous) |

Le rôle de **Product Owner** est partagé par toute l'équipe : c'est l'équipe qui possède et ordonne le backlog. Le professeur joue le rôle de client.

---

## Rituels

| Rituel | Quand | Durée | Comment |
|---|---|---|---|
| **Mêlée quotidienne** | Chaque jour de cours ensembles (en classe) + Pendant la pause commune le mardi pendant environ 1h, format : ce que j'ai fait / ce que je vais faire / ce qui bloque |
| **Planification de sprint** | Premier bloc de chaque sprint | 30–45 min | En classe, on découpe les récits en tâches GitHub et on s'assigne |
| **Revue de sprint** | Dernier bloc de chaque sprint | 20 min | Démo de l'incrément au prof |
| **Rétrospective** | Juste après la revue | 15 min | Format : ce qui a bien marché / ce qu'on change / une action concrète |

---

## Définition de « terminé » (*Definition of Done*)

Un récit est **terminé** si et seulement si :

- [ ] Le code est fusionné dans `main` via une demande de tirage (PR) relue et approuvée par au moins un coéquipier
- [ ] L'intégration continue (GitHub Actions) est verte sur `main`
- [ ] Des tests automatisés couvrent le comportement ajouté (au moins les chemins heureux et le principal cas d'erreur)
- [ ] Tous les critères d'acceptation du récit sont satisfaits et vérifiables
- [ ] L'application démarre depuis un clone neuf avec `docker compose up` sans erreur
- [ ] Aucun secret (mot de passe, clé API) n'est commis dans le dépôt

---

## Conventions

### Branches
- `main` : branche stable, toujours verte en CI
- Nomenclature : `feature/<numéro-ticket>-<description-courte>` (ex. `feature/4-ajouter-criminel`)
- Nomenclature pour corrections : `fix/<numéro-ticket>-<description-courte>`
- Pas de commit direct sur `main` — toujours passer par une PR

### Messages de commit
Chaque message doit suivre la formule : type(partie-du-projet): explications

feat : pour une nouvelle fonctionnalité (ex: feat(criminel): ajouter le formulaire)

fix : pour corriger un bug (ex: fix(auth): corriger la connexion)

test : pour ajouter ou modifier des tests

docs : pour modifier de la documentation (README, etc.)

chore : pour les tâches de configuration ou de nettoyage

Fermer un ticket automatiquement :
Écris Closes #numéro dans ton message pour fermer la tâche GitHub correspondante (ex: Closes #4).

### Revue de code
- Toute Pull Request doit avoir **1 approbation** avant fusion
- Le relecteur vérifie : logique, sécurité (pas d'injection, pas de secrets exposés), conformité à la DoD
- On ne fusionne pas sa propre PR sauf urgence documentée dans le journal

---

## Contributions individuelles — Sprint 0

*À compléter au fur et à mesure avec les liens vers les tickets GitHub une fois le backlog créé (ex. `Closes #4`).*

| Membre | Contributions | Commits |
|---|---|---|
| Massyle | Création initiale du dépôt (`dr-arobase`), rédaction et mise à jour de la vision, du backlog, de la conception et des sprints, ajout des maquettes | `bf2f7aa`, `209dd08`, `34cffc7`, `e0a0983`, `800b785`, `68a777f`, `c016794`, `7d009d7`, `854902d`, `ad2feeb` |
| Eric (Lenrics-01) | Mises à jour du backlog, fusions de branches | `6af7e77`, `9da702c`, `33e686a`, `811680c`, `e4ff297` |
| Chrysler (nleukeu) | Rédaction et correction du journal de bord | `3933be4`, `7911f58`, `8d7ba2f` |
| Michael (MichaelLaurore) | Rédaction de l'organisation de l'équipe (`05-equipe.md`) | `f8e3f34` |

> ⚠️ Deux commits d'Eric portent le message « rien » (`6af7e77`, `9da702c`) — à corriger dans les futurs commits : un message doit toujours suivre la convention `type(partie): explication` définie ci-dessus.
 