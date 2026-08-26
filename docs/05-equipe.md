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
| **Mêlée quotidienne** | Chaque jour de cours (en classe) + un soir par semaine (en ligne) | 10 min | Discord vocal, format : ce que j'ai fait / ce que je vais faire / ce qui bloque |
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
Format : `<type>(<scope>): <description courte en français>`

Types : `feat`, `fix`, `test`, `chore`, `docs`  
Exemples :
```
feat(criminal): ajouter formulaire d'ajout de dossier
fix(auth): corriger la vérification du rôle sur la route /criminals/new
test(criminal): ajouter tests unitaires pour la mise à jour de statut
```

Lier les commits et PR aux tickets : `Closes #4` dans le corps du message ou la description de la PR.

### Revue de code
- Toute PR doit avoir **1 approbation** avant fusion
- Le relecteur vérifie : logique, sécurité (pas d'injection, pas de secrets exposés), conformité à la DoD
- On ne fusionne pas sa propre PR sauf urgence documentée dans le journal

---

## Contributions individuelles — Sprint 0

*À compléter au fur et à mesure, avec des liens vers les commits et tickets.*

| Membre | Contributions |
|---|---|
| Massyle | |
| Eric | |
| Chrysler | |
| Michael | |
