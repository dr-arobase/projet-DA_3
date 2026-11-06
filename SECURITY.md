# Politique de sécurité

CrimeTracker est un projet scolaire (cours 420-5D1, Collège de Maisonneuve), mais il gère des comptes, des rôles et des fiches de personnes recherchées. Une faille doit donc être signalée **en privé**, jamais dans un ticket public.

## Version suivie

| Version | Suivie |
|---|---|
| `main` et le site en ligne | Oui |
| Étiquettes plus anciennes (`alpha-v1`, `beta-v1`) | Non |

## Signaler une faille

1. Ouvrez l'onglet **Security** du dépôt, puis **Report a vulnerability**. Le signalement n'est visible que par l'équipe.
2. Décrivez :
   - ce qu'on peut faire sans en avoir le droit (lire, modifier, se connecter comme un autre agent…);
   - les étapes pour le reproduire (requête HTTP, événement Socket.IO, page);
   - la version touchée (commit de `main`, ou le site en ligne).
3. N'essayez pas la faille sur des données réelles d'un autre agent, et n'en publiez pas le détail avant la correction.

## Ce que fait l'équipe

- **Accusé de réception** dans les 3 jours de cours suivants.
- **Correction** sur une branche `fix/…`, revue par un coéquipier, avec un test qui reproduit la faille.
- **Annonce** dans le ticket public une fois la correction en ligne, sans le détail qui permettrait de l'exploiter ailleurs.

## Secrets

Aucun secret ne doit être commis : le fichier `.env` n'est pas versionné, et `.env.example` ne contient que des valeurs d'exemple. Si un secret a été publié par erreur, prévenez Massyle (Product Owner) : il sera changé sur le serveur, ce qui ferme toutes les sessions en cours.
