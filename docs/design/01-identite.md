# Identité

## Le produit

**CrimeTracker** est l'outil de travail des agents d'une police nationale fictive. Il centralise le **registre des personnes recherchées** et diffuse chaque changement **en temps réel** à tous les agents connectés : un dossier ajouté, une capture, une alerte urgente, un signalement sur le terrain.

Le problème qu'il règle : des informations éparpillées (bases locales, radio, feuilles imprimées) et périmées. Un dossier fermé circule encore, un agent sur le terrain n'apprend pas qu'un suspect a été capturé.

> CrimeTracker permet aux policiers de consulter et de mettre à jour en temps réel le registre des personnes recherchées, et aux superviseurs d'administrer ce registre et d'alerter instantanément tous les effectifs connectés.

## Ce que l'application fait aujourd'hui

- Connexion par matricule et mot de passe, ou par compte GitHub (rôle par défaut : policier).
- Registre : liste paginée, recherche, fiche, ajout, changement de statut (recherché, capturé, libéré), retrait, dernière adresse connue.
- Tableau de bord, alertes urgentes et communiqués, diffusés en direct.
- Carte des signalements terrain (OpenStreetMap).
- Messagerie privée et de groupe : texte, fichiers, images, messages vocaux, appels audio et vidéo.
- Annuaire avec présence en ligne, statistiques, gestion des comptes, journal d'audit.

## Trois rôles

| Rôle | Peut en plus |
|---|---|
| `policier` | Lire le registre, ajouter un dossier, changer un statut, signaler, écrire et appeler |
| `superviseur` | Retirer un dossier, diffuser une alerte ou un communiqué, créer et désactiver des comptes policiers |
| `direction` | Gérer tous les comptes, promouvoir, consulter le journal d'audit |

Le serveur applique ces droits. L'interface cache ce qu'un rôle ne peut pas faire, mais ne compte jamais là-dessus.

## Non négociable

1. **L'information est à jour.** Un écran qui affiche un état périmé sans le dire est un défaut grave. Tout ce qui change ailleurs doit arriver sans recharger, ou être signalé (« Connexion temps réel interrompue »).
2. **On ne perd jamais une modification en silence.** Conflit de version : on montre l'état réel et on explique pourquoi la modification n'est pas passée.
3. **Chaque action sensible est traçable** et l'interface peut le dire (« L'action est inscrite au journal d'audit »).
4. **Lisible vite, sous pression.** Un agent doit trouver un dossier ou lire une alerte en quelques secondes.
5. **Rien de simulé n'est présenté comme réel.** Ce qui est fictif ou pas encore fait est marqué à l'écran.
6. **Données fictives seulement.** Aucune personne réelle dans les exemples, maquettes ou données de démonstration.

## Contexte du projet

Projet du cours 420-5D1 (Collège de Maisonneuve, automne 2026), en trois sprints : alpha, bêta (29 octobre), version finale. Équipe de quatre : Massyle (PO), Eric (Scrum Master), Chrysler, Michael.
