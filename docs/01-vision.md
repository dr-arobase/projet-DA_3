# Vision et portée — CrimeTracker

## Le problème

Les policiers nationaux gèrent leurs avis de recherche sur des systèmes fragmentés : bases locales non partagées, appels radio, feuilles imprimées. Quand un agent intercepte un suspect, il n'a pas accès en temps réel au registre national. Quand un superviseur met à jour un dossier, les agents sur le terrain ne le savent pas immédiatement. Cette fragmentation allonge les délais d'arrestation et multiplie les erreurs (dossier fermé mais toujours en circulation, informations périmées transmises sur le terrain).

CrimeTracker est une application web qui centralise le registre national des personnes recherchées et le diffuse en temps réel à tous les agents connectés, pour que chaque mise à jour soit instantanément visible partout.

## Personnes utilisatrices

| Profil | Grades associés | Ce qu'il cherche | Rôle applicatif |
|---|---|---|---|
| **Policier** | Sergent ou sergente autres fonctions | Consulter rapidement un dossier, ajouter un individu, signaler une observation, mettre à jour un statut et recevoir des alertes urgentes sans interrompre son travail | `policier` |
| **Superviseur** | Sergent ou sergente gestionnaire, sergent ou sergente responsable de poste, lieutenant ou lieutenante, capitaine, inspecteur ou inspectrice, inspecteur-chef ou inspectrice-cheffe | Administrer le registre (modifier, retirer des dossiers), diffuser des alertes et gérer les comptes des policiers | `superviseur` |
| **Direction de la police** | Directeur général adjoint ou directrice générale adjointe, directeur général ou directrice générale | Administrer tous les comptes, consulter le journal d'audit et assurer la supervision complète du registre | `direction` |

### Grades pris en charge

- Directeur général ou directrice générale
- Directeur général adjoint ou directrice générale adjointe
- Inspecteur-chef ou inspectrice-cheffe
- Inspecteur ou inspectrice
- Capitaine
- Lieutenant ou lieutenante
- Sergent ou sergente autres fonctions
- Sergent ou sergente gestionnaire
- Sergent ou sergente responsable de poste

## Proposition en une phrase

> CrimeTracker est une application qui permet aux policers de consulter et mettre à jour en temps réel le registre national des personnes recherchées, et aux superviseurs d'administrer ce registre et d'alerter instantanément tous les effectifs connectés.

## Portée

### Dans la portée
- Authentification par badge et mot de passe, trois rôles hiérarchiques (`policier` / `superviseur` / `direction`) et attribution d'un grade
- Registre des personnes recherchées : les policiers peuvent créer un dossier; les superviseurs et la direction peuvent le modifier ou le retirer
- Mise à jour du statut d'un dossier avec horodatage et traçabilité
- Tableau de bord temps réel : tout changement (ajout, capture, alerte) est visible instantanément chez tous les agents connectés
- Diffusion d'alertes urgentes par un superviseur
- Signalement d'observations par les agents (lieu, heure, notes)
- Gestion des comptes policiers par les superviseurs et la direction
- Promotion d'un policier par la direction, avec changement de grade, de rôle et inscription dans le journal d'audit
- Déploiement sur serveur accessible publiquement

### Hors portée
- Application mobile native ou hybride
- Reconnaissance faciale ou biométrie
- Intégration avec des bases de données externes (Interpol, SNCF, etc.)
- Cartographie GPS en temps réel des agents sur le terrain
- Système de messagerie interne entre agents
- Gestion des procédures judiciaires (mandats, audiences)

---

## Respect des exigences techniques

| # | Exigence | Technologie retenue | Comment CrimeTracker la satisfait |
|---|---|---|---|
| 1 | Application web **client-serveur, cadriciel *full stack***, rendu côté serveur et côté client | **React Router v7** (mode *framework*) avec **Node.js** | Les pages principales (liste, profil) sont rendues côté serveur (SSR) pour la rapidité et le référencement ; le tableau de bord temps réel est mis à jour côté client via Socket.IO sans rechargement |
| 2 | **Base de données transactionnelle** | **PostgreSQL** | Les mises à jour de statut utilisent des transactions avec verrouillage optimiste (champ `version`) ; deux agents qui modifient le même dossier simultanément : un réussit, l'autre reçoit un refus explicite |
| 3 | **Docker** | **Docker** + **Docker Compose** | Un `docker-compose.yml` démarre l'application Node.js + la base PostgreSQL + les variables d'environnement ; aucune installation manuelle requise |
| 4 | **Rôles hiérarchiques** avec authentification | Sessions JWT + middleware d'autorisation maison | `policier` : lecture, ajout de dossier, signalement et mise à jour de statut. `superviseur` : tout ce que fait le policier, plus modifier/retirer des dossiers, créer et gérer les comptes policiers, diffuser des alertes urgentes. `direction` : tous les droits du superviseur, plus la gestion de tous les comptes et la consultation du journal d'audit |
| 5 | **Fonctionnalité temps réel multi-utilisateurs** | **Socket.IO** | Le tableau de bord est le cœur de l'application : chaque changement de statut, nouvel ajout ou alerte urgente est diffusé en temps réel à tous les agents connectés. L'application n'a pas de sens sans cette fonctionnalité |
| 6 | **Point de concurrence réel** | Verrouillage optimiste PostgreSQL (`version`) | Deux superviseurs qui marquent simultanément le même criminel comme « capturé » : la première requête réussit et incrémente le numéro de version ; la seconde détecte la divergence de version et reçoit un message d'erreur avec l'état courant |
| 7 | **Tests automatisés** à chaque poussée | **GitHub Actions** + **Vitest** (unit) + **Playwright** (e2e) | Pipeline CI déclenché sur chaque `push` : lint → tests unitaires → tests d'intégration → build Docker |
| 8 | **Déploiement sur serveur** | Serveur du département ou **Render / Railway** (à préciser en cours de session) | L'image Docker est déployée sur un serveur accessible publiquement par URL |
