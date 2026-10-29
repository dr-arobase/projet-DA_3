# Voix

L'interface parle comme un collègue expérimenté au poste : précise, calme, brève. Elle ne vend rien, elle informe et elle dit quoi faire.

## Principes

- **Français du Québec**, avec **vouvoiement** : « Choisissez un dossier », « Identifiez-vous avec vos accès professionnels ».
- **Phrases courtes, à la voix active.** Le bouton dit exactement ce qui va se passer (« Diffuser l'alerte », « Retirer le dossier »), et la confirmation reprend le même verbe (« Alerte diffusée »).
- **Les mots du métier**, pas ceux du code : on dit *dossier*, pas *criminal* ; *matricule*, pas *badge_number* ; *agent connecté*, pas *socket*.
- **Pas d'enthousiasme.** Pas de point d'exclamation, pas de « Super ! », pas d'émoji dans les textes de l'application (les émojis restent dans les messages que les agents s'écrivent).

## Vocabulaire

| Dire | Ne pas dire |
|---|---|
| Personne recherchée, dossier | Criminel, fiche criminelle, suspect (sauf dans une observation) |
| Matricule | Badge, identifiant, ID |
| Agent (policier, superviseur, direction) | Utilisateur, user |
| Signalement, observation | Report, rapport |
| Alerte urgente / communiqué | Notification push, broadcast |
| Retirer un dossier | Supprimer, effacer (sauf pour un message) |
| Capturé, libéré, recherché | Arrêté, fermé, actif |
| Journal d'audit | Logs |

## Messages d'erreur

Toujours : **ce qui s'est passé**, puis **ce que l'agent peut faire**. Jamais d'excuse, jamais de code technique seul.

| Bien | Mal |
|---|---|
| « Ce dossier a été modifié entre-temps par SM-002 : son statut est maintenant « capturé ». Votre changement n'a pas été appliqué. » | « Erreur 409 » |
| « Micro refusé : autorisez le micro pour ce site dans le navigateur, puis réessayez. » | « NotAllowedError » |
| « Le fichier dépasse 10 Mo. » | « Payload too large » |
| « Serveur injoignable. Vérifiez que le backend est démarré. » | « Oups, quelque chose s'est mal passé ! » |

## États vides

Dire ce qui manque et comment le créer : « Aucune conversation. Cherchez un agent pour lui écrire. », « Aucune alerte diffusée. »

## Dates et nombres

- Dates courtes à la québécoise : « jeu. 29 oct. », heures « 11 h 49 » (format `fr-CA`).
- Durées : « il y a 2 min », « 1:24 ».
- Tailles : « 1,4 Mo », « 320 ko ».
- Grades et rôles en toutes lettres (« Sergent responsable de poste »), abréviation seulement devant un nom (« Lt. Tremblay »).
