# Contribuer à CrimeTracker

Ce guide décrit comment l'équipe travaille au quotidien. Les rôles, les rituels et la définition de terminé sont détaillés dans [docs/05-equipe.md](docs/05-equipe.md).

## 1. Prendre un ticket

1. Choisir un ticket de la colonne **Sprint** du [Project](https://github.com/users/dr-arobase/projects/2).
2. S'en assigner la responsabilité sur GitHub et le déplacer dans **En cours**.

## 2. Travailler sur une branche

`main` ne reçoit que des pull requests. Une branche par ticket, créée depuis `main` à jour :

```bash
git switch main && git pull
git switch -c feature/6-ajout-dossier     # nouvelle fonctionnalité
git switch -c fix/12-cookie-expire        # correction
git switch -c chore/24-organisation       # configuration, ménage, documentation
```

Messages de commit : `type(partie): message`, par exemple `feat(registre): formulaire d'ajout d'un dossier`.

| Type | Pour |
|---|---|
| `feat` | une nouvelle fonctionnalité |
| `fix` | une correction de bug |
| `test` | ajouter ou modifier des tests |
| `docs` | la documentation |
| `chore` | configuration, dépendances, ménage |

Chacun commite depuis son propre compte GitHub, régulièrement : l'historique Git sert de preuve de contribution.

## 3. Ouvrir une pull request

1. `git push -u origin <branche>`, puis ouvrir la PR vers `main`. Le modèle de PR s'affiche : le remplir.
2. Écrire `Closes #<numéro>` dans la description : le ticket se ferme à la fusion.
3. Déplacer le ticket dans **En revue** et demander la revue d'un coéquipier.

## 4. Revue et fusion

- Une approbation d'un coéquipier est nécessaire ; on ne fusionne jamais sa propre PR.
- Le relecteur laisse un commentaire concret (logique, sécurité, test manquant), pas seulement « LGTM ».
- La CI doit être verte. En cas de retour, corriger sur la même branche et pousser à nouveau.
- Après la fusion, le ticket passe dans **Terminé**.

## Définition de terminé

- [ ] Critères d'acceptation du ticket vérifiés dans le navigateur, cas d'erreur compris
- [ ] Au moins un test automatisé qui échoue si le comportement change
- [ ] PR revue et approuvée par un coéquipier, CI verte
- [ ] `docker compose up --build` fonctionne toujours depuis un clone neuf
- [ ] Aucun secret dans le dépôt

## Vérifications automatiques

- **Hook `pre-push`** (activé par `npm install`) : refuse un push vers `main` si `main` n'est pas à jour, si l'historique serait réécrit, ou si les tests, le démarrage du serveur ou le build du frontend échouent. Lancer la même vérification à la main : `npm run verifier` à la racine.
- **CI GitHub Actions** : à chaque push et chaque PR, elle refait ces vérifications et démarre l'application complète avec Docker.
