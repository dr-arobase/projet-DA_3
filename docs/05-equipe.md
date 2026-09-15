# Organisation de l'équipe — CrimeTracker

## Membres

| Prénom | Rôle |
|---|---|
| Massyle | Product Owner |
| Eric | Scrum Master |
| Chrysler | Testeur |
| Michael | Testeur |

**Massyle** est Product Owner : il priorise et ordonne le backlog en concertation avec l'équipe. **Eric** est Scrum Master : il anime la mêlée quotidienne, la planification et la rétrospective. **Chrysler** et **Michael** agissent comme testeurs : ils valident les critères d'acceptation et les tests avant chaque revue de sprint. Le professeur joue le rôle de client.

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

## Contributions individuelles

| Membre | Rôle | Contributions principales | Liens utiles |
|---|---|---|---|
| **Massyle** | Product Owner | Priorisation du backlog, cadrage du produit, définition des besoins et gestion de la conformité du projet | [#3](https://github.com/dr-arobase/projet-DA_3/issues/3), [#4](https://github.com/dr-arobase/projet-DA_3/issues/4), [#10](https://github.com/dr-arobase/projet-DA_3/issues/10), [63b682b](https://github.com/dr-arobase/projet-DA_3/commit/63b682b) |
| **Eric** | Scrum Master | Coordination de la planification, suivi des sprints, organisation et animation des rituels | [#11](https://github.com/dr-arobase/projet-DA_3/issues/11), [#12](https://github.com/dr-arobase/projet-DA_3/issues/12), [#13](https://github.com/dr-arobase/projet-DA_3/issues/13), [df7a67b](https://github.com/dr-arobase/projet-DA_3/commit/df7a67b) |
| **Chrysler** | Testeur | Vérification des critères d'acceptation, revue des parcours utilisateur et validation fonctionnelle | [#6](https://github.com/dr-arobase/projet-DA_3/issues/6), [#7](https://github.com/dr-arobase/projet-DA_3/issues/7), [#8](https://github.com/dr-arobase/projet-DA_3/issues/8), [c7297e3](https://github.com/dr-arobase/projet-DA_3/commit/c7297e3) |
| **Michael** | Testeur | Validation des cas d'erreur, revue des maquettes et contrôle de la cohérence du backlog | [#14](https://github.com/dr-arobase/projet-DA_3/issues/14), [#15](https://github.com/dr-arobase/projet-DA_3/issues/15), [#16](https://github.com/dr-arobase/projet-DA_3/issues/16), [e4ff297](https://github.com/dr-arobase/projet-DA_3/commit/e4ff297) |

Les contributions sont rattachées aux tickets GitHub et aux commits du dépôt pour garder une traçabilité claire entre le travail produit et le backlog de la remise.
