# Rétrospective du sprint 2

## Date

Vendredi 30 octobre 2026, après l'échéance de la bêta (jeudi 29 octobre, 23 h 59).

## Participants

- Massyle (Product Owner)
- Eric (Scrum Master)
- Chrysler
- Michael

Chaque membre rédige sa partie à partir de son propre historique GitHub. Celle de Massyle est ci-dessous.

## Partie de Massyle (Product Owner)

Établie à partir de l'historique GitHub du 7 au 30 octobre : 28 PR fusionnées, 61 tickets d'audit créés, aucune revue reçue (le détail est dans `04-sprints.md`).

### Ce qui a bien fonctionné

- Le récit #50 (connexion GitHub, OAuth 2), exigé par l'énoncé de la bêta, a été livré le 16 octobre, avec ses tests.
- L'audit du 15 octobre (#67) a transformé les problèmes trouvés en 61 tickets (#73 à #133), chacun avec un responsable : une bonne partie a été corrigée par l'équipe avant la fin du sprint (#139 de Chrysler, #150 d'Eric, #136 de Michael).
- L'application est en ligne depuis le 28 octobre (Azure, HTTPS) et se met à jour seule après chaque fusion dans `main` : plus besoin de cloner le dépôt pour la montrer.
- La messagerie est devenue complète : non-lus, modification et suppression, fichiers et messages vocaux, appels audio et vidéo, réactions, appels manqués.
- Le travail de Chrysler (#139) a été intégré en gardant ses commits et son nom comme auteur.

### Ce qui a été difficile

- **Aucune de mes 28 PR n'a été revue par un coéquipier.** Notre définition de « terminé » exige une revue; je ne l'ai pas respectée, même quand des coéquipiers étaient disponibles.
- Mon travail est arrivé en **deux grands lots** (15-16 octobre, puis 28-30 octobre), avec rien entre le 17 et le 27 octobre. Les grosses PR de la fin (#146, #147, #158) étaient difficiles à revoir.
- J'ai écrit l'engagement du sprint en retard (le 15 octobre, au lieu du 9).
- L'étiquette `beta-v1` n'a pas été posée à l'échéance du 29 octobre.
- Certaines fonctions ont d'abord été livrées avec des défauts trouvés ensuite à l'usage : boutons d'appel grisés, micro bloqué sur la version en ligne par l'en-tête `Permissions-Policy`, contenu qui dépassait de l'écran sur téléphone.
- La simulation de 100 agents (30 octobre) a montré qu'en début de quart, la limite de tentatives de connexion par adresse IP refuse la plupart des agents d'un même poste. Ce problème n'est pas encore corrigé.

### Ce que je veux améliorer

- Ouvrir des PR plus petites, au fil du sprint, et ne fusionner qu'après la revue d'un coéquipier.
- Écrire l'engagement du sprint au premier bloc, et le tenir à jour à chaque point de contrôle.
- Vérifier chaque fonction sur un vrai téléphone et sur la version en ligne avant de la considérer comme terminée.
- Poser l'étiquette de remise le jour même, sur un `main` dont la CI est verte.

### Actions pour le sprint 3

| Action | Comment on saura qu'elle est faite |
|---|---|
| Une revue par PR, avec un commentaire concret | Chaque PR de Massyle au sprint 3 a au moins une revue enregistrée sur GitHub |
| Corriger la limite de tentatives de connexion (compter seulement les échecs, par adresse IP et matricule) | 100 connexions simultanées d'un même poste réussissent, test automatisé à l'appui |
| Étiquette de remise posée avant l'échéance | `git ls-remote --tags origin` montre l'étiquette à la date de la remise |
| Terminer la direction de design E sur toutes les pages | Aucune page ne défile sur le côté, de 320 px à l'écran d'ordinateur |
