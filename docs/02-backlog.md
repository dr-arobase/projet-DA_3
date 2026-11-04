# Backlog produit — CrimeTracker

> Le backlog complet (tickets, priorités, points, sprints) vit dans le **[projet GitHub](../../projects/1)**.  
> Ce fichier est une photo figée au moment de la remise (`soumission-v1`).

---

> Les numéros de récit ne sont pas ceux des tickets GitHub : la colonne « Ticket » fait le lien (récit n = ticket #n+2). Les tableaux de `04-sprints.md` utilisent les numéros de récit.

## Épiques

| Épique | Description |
|---|---|
| **AUTH** — Authentification et comptes | Connexion sécurisée, gestion des rôles et grades, création et désactivation de comptes policiers |
| **REGISTRE** — Gestion du registre | Consulter, ajouter, modifier, retirer des dossiers de personnes recherchées |
| **REALTIME** — Tableau de bord temps réel | Diffusion instantanée des changements à tous les policiers connectés, alertes urgentes |
| **TERRAIN** — Signalements terrain | Enregistrement des observations par les policiers (lieu, heure, notes) |
| **ADMIN** — Administration | Journal d'audit, statistiques, présence des policiers en ligne |

---

## Liste ordonnée des récits `Must`

| # | Ticket | Récit | Épique | Points | Sprint |
|---|---|---|---|---|---|
| 1 | [#3](https://github.com/dr-arobase/projet-DA_3/issues/3) | En tant que policier, je veux me connecter avec mon numéro de badge et mon mot de passe afin d'accéder de façon sécurisée au système | AUTH | 5 | 1 |
| 2 | [#4](https://github.com/dr-arobase/projet-DA_3/issues/4) | En tant que policier, je veux consulter la liste paginée des personnes recherchées afin d'avoir une vue d'ensemble à jour du registre | REGISTRE | 2 | 1 |
| 3 | [#5](https://github.com/dr-arobase/projet-DA_3/issues/5) | En tant que policier, je veux voir le profil complet d'un dossier afin d'avoir toutes les informations nécessaires à l'identification | REGISTRE | 3 | 1 |
| 4 | [#6](https://github.com/dr-arobase/projet-DA_3/issues/6) | En tant que policier, je veux ajouter un nouveau dossier au registre afin de rendre la personne visible à tous les effectifs | REGISTRE | 5 | 1 |
| 5 | [#7](https://github.com/dr-arobase/projet-DA_3/issues/7) | En tant que superviseur, je veux retirer un dossier du registre afin de tenir la liste à jour après une arrestation ou une erreur | REGISTRE | 3 | 1 |
| 6 | [#8](https://github.com/dr-arobase/projet-DA_3/issues/8) | En tant que policier, je veux mettre à jour le statut d'un dossier afin de signaler une capture ou un changement de situation | REGISTRE | 3 | 1 |
| 7 | [#9](https://github.com/dr-arobase/projet-DA_3/issues/9) | En tant que policier, je veux filtrer et rechercher les dossiers par nom ou statut afin de trouver rapidement la personne qui m'intéresse | REGISTRE | 3 | 1 |
| 8 | [#10](https://github.com/dr-arobase/projet-DA_3/issues/10) | En tant que superviseur, je veux créer le compte d'un nouveau policier afin de lui donner accès au système | AUTH | 3 | 2 |
| 9 | [#11](https://github.com/dr-arobase/projet-DA_3/issues/11) | En tant que policier, je veux voir les nouvelles alertes et changements de statut apparaître en temps réel sur mon tableau de bord afin d'être informé instantanément sans recharger la page | REALTIME | 8 | 2 |
| 10 | [#12](https://github.com/dr-arobase/projet-DA_3/issues/12) | En tant que superviseur, je veux diffuser une alerte urgente à tous les policiers connectés afin de les mobiliser immédiatement sur une situation critique | REALTIME | 5 | 2 |
| 11 | [#13](https://github.com/dr-arobase/projet-DA_3/issues/13) | En tant que policier, je veux signaler une observation d'une personne recherchée (lieu, heure, notes) afin d'alimenter le dossier avec les dernières informations terrain | TERRAIN | 5 | 2 |
| 12 | [#14](https://github.com/dr-arobase/projet-DA_3/issues/14) | En tant que policier, je veux voir la liste des policiers actuellement connectés afin de connaître les effectifs disponibles en temps réel | REALTIME | 3 | 3 |
| 13 | [#15](https://github.com/dr-arobase/projet-DA_3/issues/15) | En tant que policier, je veux recevoir un refus explicite si un autre policier a modifié le même dossier en même temps que moi afin de ne pas écraser ses changements | REGISTRE | 8 | 3 |

---

## Récits `Should`

| # | Ticket | Récit | Épique | Points | Sprint |
|---|---|---|---|---|---|
| 14 | [#16](https://github.com/dr-arobase/projet-DA_3/issues/16) | En tant que superviseur, je veux désactiver le compte d'un policier afin de révoquer son accès | AUTH | 2 | 2 |
| 15 | [#17](https://github.com/dr-arobase/projet-DA_3/issues/17) | En tant que superviseur, je veux consulter l'historique des signalements sur un dossier afin de reconstituer les déplacements récents | TERRAIN | 3 | 3 |
| 16 | [#18](https://github.com/dr-arobase/projet-DA_3/issues/18) | En tant que superviseur, je veux accéder à un journal d'audit des actions sensibles afin de garantir la traçabilité | ADMIN | 5 | 3 |
| 17 | [#19](https://github.com/dr-arobase/projet-DA_3/issues/19) | En tant que membre de la direction, je veux promouvoir un policier et lui attribuer un grade de superviseur afin de gérer les responsabilités de l'équipe | AUTH | 3 | 3 |

---

## Récits `Could`

| # | Ticket | Récit |
|---|---|---|
| 18 | [#20](https://github.com/dr-arobase/projet-DA_3/issues/20) | Tableau de statistiques globales (dossiers ouverts, captures ce mois, etc.) |
| 19 | [#21](https://github.com/dr-arobase/projet-DA_3/issues/21) | Une maps permettant de localiser visuellement le lieu où sont prises les photos|
| 20 | — | Application mobile native |
---

## Récits `Won't` (hors portée pour cette session)

| # | Récit | Raison |
|---|---|---|
| 21 | Intégration avec Interpol ou bases externes | API payante, hors contrôle |
| 22 | Reconnaissance faciale | Complexité technique hors programme |
| 23 | Export PDF du registre | Valeur faible face à l'effort |
|24 | Empreintes digital | Complexité technique hors programme|

---

## Démarche d'estimation

**Échelle Fibonacci** : 1, 2, 3, 5, 8, 13.

**Récit de référence** : « Consulter la liste des personnes recherchées » (récit #2) = **2 points** — affichage d'une liste paginée depuis la base de données, sans logique métier complexe, environ 3–4 heures de travail.

**Calibrage** :
- 1 pt : tâche triviale, modification mineure (< 2h)
- 2 pts : affichage simple avec lecture base de données (3–4h)
- 3 pts : fonctionnalité CRUD avec validation et autorisation (4–6h)
- 5 pts : fonctionnalité avec logique métier et plusieurs composants liés (6–10h)
- 8 pts : fonctionnalité complexe impliquant de nouvelles technologies (Socket.IO, concurrence) ou plusieurs couches (10–16h)
- 13 pts : trop gros, à découper obligatoirement

**Méthode de consensus** : planning poker (chacun propose en silence, on discute les écarts > 1 rang). En cas de désaccord persistant, on prend la valeur la plus haute et on explore si le récit peut être découpé.
