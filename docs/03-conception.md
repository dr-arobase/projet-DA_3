# Conception technique — CrimeTracker

> Ce document est conçu pour le sprint 1
---

## Modèle de données initial

```mermaid
erDiagram
    USER {
        int id PK
        string first_name
        string last_name
        string badge_number UK
        string email UK
        string password_hash
        enum role "policier | superviseur | direction"
        enum grade "sergent_autres_fonctions | sergent_gestionnaire | sergent_responsable_de_poste | lieutenant | capitaine | inspecteur | inspecteur_chef | directeur_general_adjoint | directeur_general"
        bool is_active
        timestamp created_at
    }
    CRIMINAL {
        int id PK
        string first_name
        string last_name
        date date_of_birth
        string nationality
        string photo_url
        enum status "recherche | capture | libere"
        text description
        text crimes
        int added_by FK
        int updated_by FK
        int version
        timestamp added_at
        timestamp updated_at
    }
    CRIMINAL_STATUS_HISTORY {
        int id PK
        int criminal_id FK
        enum status "recherche | capture | libere"
        int changed_by FK
        timestamp changed_at
    }
    SIGHTING {
        int id PK
        int criminal_id FK
        int reported_by FK
        string location
        text notes
        timestamp reported_at
    }
    ALERT {
        int id PK
        int issued_by FK
        int criminal_id FK "nullable"
        string message
        enum severity "info | urgent"
        timestamp created_at
    }
    AUDIT_LOG {
        int id PK
        int actor_id FK
        string action
        string target_type
        int target_id
        json details
        timestamp created_at
    }

    USER ||--o{ CRIMINAL : "ajoute / modifie"
    USER ||--o{ SIGHTING : "signale"
    USER ||--o{ ALERT : "émet"
    USER ||--o{ AUDIT_LOG : "effectue"
    CRIMINAL ||--o{ SIGHTING : "concerne"
    CRIMINAL ||--o{ CRIMINAL_STATUS_HISTORY : "a eu le statut"
    USER ||--o{ CRIMINAL_STATUS_HISTORY : "change"
    CRIMINAL ||--o{ ALERT : "concerne (optionnel)"
```

### Notes sur le sprint 1
- Le schéma réel est [`backend/serveur/database/schema.sql`](../backend/serveur/database/schema.sql) ; la table SQL des comptes s'appelle `app_user` (`user` est un mot réservé de PostgreSQL).
- `CRIMINAL.version` : entier incrémenté par un déclencheur à chaque mise à jour. Dès le sprint 1, `PATCH /api/criminals/:id` exige la version lue et refuse (409) une version périmée — critère du récit #6 qui prépare le récit #13.
- `CRIMINAL_STATUS_HISTORY` : ajoutée au sprint 1 (décision 7) — une ligne par statut pris par un dossier, avec son auteur et sa date.
- `CRIMINAL.crimes` : stocké en texte libre pour le sprint 1 ; normalisé en table séparée si besoin au sprint 2.
- `SIGHTING` et `ALERT` : entités créées au sprint 1 au niveau du schéma, fonctionnellement activées au sprint 2.
- `AUDIT_LOG` : conserve les actions sensibles (promotion, désactivation de compte, retrait de dossier et diffusion d'alerte) avec leur auteur, leur cible et la date; sa consultation est prévue au sprint 3.
- Contraintes de rôle : `policier` est associé au grade « sergent autres fonctions », `superviseur` aux grades de sergent gestionnaire à inspecteur-chef et `direction` aux grades de directeur général adjoint ou directeur général. Une promotion valide le grade avant de modifier le rôle.

---

## Principales routes

### Pages (Express + HTML/Bulma — voir décision 4)

| Route | Rôle | Accès |
|---|---|---|
| `GET /login` | Formulaire de connexion | Public |
| `GET /` | Tableau de bord (compteurs par statut ; alertes temps réel au sprint 2) | Connecté, sinon redirection vers `/login` |
| `GET /criminals` | Liste paginée avec recherche et filtre | Connecté |
| `GET /criminals/:id` | Profil complet, changement de statut, retrait | Connecté |
| `GET /criminals/new` | Formulaire d'ajout | Connecté |
| `GET /api-docs` | Documentation Swagger de l'API | Public |

### API REST

Livrées au sprint 1 : `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` (compte connecté) et les cinq routes `/api/criminals`. Les autres lignes du tableau sont prévues aux sprints 2 et 3. Tous les rôles authentifiés (`policier`, `superviseur`, `direction`) ont les droits d'un policier ; `direction` a aussi ceux d'un superviseur.

| Méthode | Route | Description | Rôle requis |
|---|---|---|---|
| `POST` | `/auth/login` | Authentification, retourne cookie de session | — |
| `POST` | `/auth/logout` | Invalidation de session | Authentifié |
| `GET` | `/api/criminals` | Liste paginée, filtrable par nom et statut | `policier` |
| `POST` | `/api/criminals` | Créer un dossier | `policier` |
| `GET` | `/api/criminals/:id` | Détail d'un dossier | `policier` |
| `PATCH` | `/api/criminals/:id` | Mettre à jour statut (avec `version`) | `policier` |
| `DELETE` | `/api/criminals/:id` | Retirer un dossier | `superviseur` |
| `POST` | `/api/sightings` | Signaler une observation | `policier` |
| `GET` | `/api/users` | Liste des comptes policiers et superviseurs | `superviseur` ou `direction` |
| `POST` | `/api/users` | Créer un compte policier | `superviseur` |
| `PATCH` | `/api/users/:id/status` | Désactiver ou réactiver un compte policier | `superviseur` |
| `PATCH` | `/api/users/:id/promotion` | Promouvoir un policier et modifier son grade | `direction` |
| `GET` | `/api/audit-logs` | Consulter le journal des actions sensibles | `direction` |
| `GET` | `/api/criminals/:id/sightings` | Consulter l'historique des signalements | `superviseur` |

La route de promotion accepte un grade supérieur, change le rôle applicatif vers `superviseur`, invalide les anciennes permissions de policier et ajoute une entrée au journal d'audit. Un policier ne peut pas modifier son propre rôle.

Exemple de requête :

```json
{
    "role": "superviseur",
    "grade": "lieutenant"
}
```

### Événements Socket.IO (sprint 2–3)

| Direction | Événement | Payload | Déclencheur |
|---|---|---|---|
| Serveur → clients | `criminal:added` | `{ criminal }` | Nouveau dossier créé |
| Serveur → clients | `criminal:updated` | `{ id, status, updated_by, updated_at }` | Statut modifié |
| Serveur → clients | `criminal:removed` | `{ id }` | Dossier retiré |
| Serveur → clients | `alert:broadcast` | `{ id, message, severity, issued_by, created_at }` | Alerte urgente émise |
| Serveur → clients | `presence:update` | `{ online_users[] }` | Connexion / déconnexion |
| Client → serveur | `alert:send` | `{ message, severity, criminal_id? }` | Superviseur diffuse une alerte |

Les changements de statut, les nouveaux dossiers et les alertes sont diffusés à tous les clients authentifiés; la liste de présence contient uniquement les comptes actifs.

---

## Maquettes

Les maquettes se trouvent dans le dossier [`maquettes/`](maquettes/).

| Fichier | Écran |
|---|---|
| `CrimeTracker-mobile-connexion.pdf` | Connexion par matricule et mot de passe |
| `CrimeTracker-mobile-ajout-personne-recherchee.pdf` | Ajout d'un dossier de personne recherchée |
| `CrimeTracker-mobile-alertes-temps-reel.pdf` | Alertes et communiqués diffusés en temps réel |
| `CrimeTracker-mobile-gestion-utilisateurs.pdf` | Gestion des utilisateurs et activation des comptes |

---

## Registre de décisions

### Décision 1 — Authentification à deux facteurs

**Question** : comment sécuriser la connexion des policiers, des superviseurs et de la direction ?

**Options envisagées** :
- Badge et mot de passe seuls : simple, mais un mot de passe volé ou deviné suffit pour accéder au registre.
- Badge, mot de passe et code envoyé par courriel ou SMS : ajoute une étape, mais dépend d'un service externe.
- Badge, mot de passe et code généré par une application d'authentification (TOTP) : ajoute une étape, sans dépendre d'un envoi externe.

**Choix retenu** : badge, mot de passe et code généré par une application d'authentification.

**Raison** : le registre contient des informations sensibles sur des personnes recherchées; un accès non autorisé aurait des conséquences importantes. Le deuxième facteur limite le risque qu'un mot de passe compromis suffise à se connecter, et un code TOTP ne dépend pas de la disponibilité d'un service de courriel ou de SMS.

**Prix de ce choix** : chaque policier doit configurer une application d'authentification avant sa première connexion, et une procédure de récupération doit être prévue en cas de perte de l'appareil.

---

### Décision 2 — PostgreSQL avec verrouillage optimiste pour la concurrence

**Question** : comment gérer deux policiers qui modifient le même dossier simultanément ?

**Options envisagées** :
- Verrouillage pessimiste (`SELECT FOR UPDATE`) : bloque la ressource pendant la transaction
- Verrouillage optimiste (champ `version`) : détecte le conflit au moment de l'écriture
- Pas de gestion (dernier écrit gagne — `last-write-wins`)

**Choix retenu** : verrouillage optimiste avec champ `version` dans la table `CRIMINAL`.

**Raison** : les conflits simultanés seront rares (deux policiers sur le même dossier au même instant). Le verrouillage pessimiste pénaliserait inutilement tous les policiers. Le `last-write-wins` ne respecte pas l'exigence du projet.

**Prix de ce choix** : le client doit envoyer le numéro de version courant avec chaque mise à jour, et gérer le cas de rejet en affichant le statut actuel.

---

### Décision 3 — Socket.IO plutôt que Server-Sent Events (SSE) pour le temps réel

**Question** : comment diffuser les alertes et les changements en temps réel ?

**Options envisagées** :
- WebSockets natifs : contrôle complet, mais reconnexion à gérer manuellement.
- Socket.IO : reconnexion automatique et événements nommés.
- Server-Sent Events (SSE) : communication principalement du serveur vers les clients.
- Polling : simple, mais moins réactif et plus coûteux en requêtes.

**Choix retenu** : Socket.IO.

**Raison** : Socket.IO permet de diffuser les alertes, les changements de statut et la présence des policiers sans rechargement. Il gère aussi la reconnexion et la communication bidirectionnelle.

**Fonctionnement** : le serveur authentifie la session, enregistre l'action dans PostgreSQL, puis diffuse l'événement aux clients connectés.

**Deux alertes simultanées** : chaque alerte est enregistrée séparément dans `ALERT` avec un identifiant unique. Aucune alerte n'écrase l'autre; les deux sont ensuite diffusées aux clients.

**Déconnexion et erreurs** : Socket.IO tente automatiquement de se reconnecter. Une alerte qui n'est pas enregistrée n'est pas diffusée.

**Prix de ce choix** : Socket.IO ajoute une dépendance et une configuration supplémentaire avec Docker, mais il est plus adapté que SSE à la communication bidirectionnelle.

---

### Décision 4 — Pages HTML servies par Express plutôt que React Router v7 (sprint 1)

**Question** : avec quelle technologie construire l'interface de l'alpha ?

**Options envisagées** :
- React Router v7 en rendu serveur (prévu à la soumission) : un second projet Node, une étape de construction et une image Docker de plus.
- Pages HTML statiques servies par le même serveur Express, avec Bulma et un peu de JavaScript qui appelle l'API.

**Choix retenu** : pages HTML + Bulma servies par Express (`backend/serveur/public/`).

**Raison** : au point de contrôle 2, aucun écran n'existait encore. Un seul serveur et une seule image gardent la commande `docker compose up` simple, et l'interface consomme exactement l'API REST documentée dans Swagger — celle que réutilisera un éventuel client mobile. Les pages restent en couche séparée (`public/`) de la logique serveur (`routes/`, `controllers/`) et de l'accès aux données (`models/`).

**Prix de ce choix** : pas de rendu serveur ni de composants réutilisables ; si l'interface grossit au sprint 2 (temps réel), la migration vers React reste possible sans toucher à l'API.

---

### Décision 5 — Session par cookie HTTP-only contenant un JWT

**Question** : comment garder un policier connecté jusqu'à sa déconnexion (critère du récit #1) ?

**Choix retenu** : à la connexion, le serveur pose un cookie `session` HTTP-only (`SameSite=Lax`, 8 h, la durée d'un quart) qui contient un JWT signé. À chaque requête, le compte est relu en base : un compte désactivé perd l'accès immédiatement. La déconnexion efface le cookie.

**Raison** : un cookie HTTP-only n'est pas lisible par JavaScript (protection contre le vol de session par injection de script), et le navigateur l'envoie tout seul, y compris depuis Swagger.

**Prix de ce choix** : la double authentification (décision 1) est reportée au sprint 2, où l'authentification externe est au programme ; c'est annoncé à l'écran et dans le README. Les mots de passe sont hachés avec bcrypt (`bcryptjs`, pur JavaScript, pour éviter une compilation native dans l'image Alpine).

---

### Décision 6 — Création de la base au démarrage et stratégie de tests

**Question** : comment créer la base automatiquement et la tester ?

**Choix retenu** :
- Au démarrage, le serveur exécute `schema.sql` si la table `app_user` n'existe pas, puis `seed.sql` si aucun compte n'existe. Pas d'outil de migration pour l'alpha : un seul script, rejoué seulement sur une base vide.
- Tests Jest + Supertest à deux niveaux : unitaires (validateurs) et intégration contre un **vrai PostgreSQL** (base `crimetracker_test`, vidée et recréée à chaque exécution ; le code refuse de vider une base dont le nom ne finit pas par `_test`). Ils tournent dans GitHub Actions à chaque poussée, puis la CI vérifie que `docker compose up` démarre l'application.

**Prix de ce choix** : une modification du schéma après le sprint 1 exigera un vrai outil de migration (ou `docker compose down --volumes`).

---

### Décision 7 — Table d'historique des statuts

**Question** : le récit #3 demande que « l'historique de statut (dates de changement) » soit visible ; le modèle de la soumission ne garde que le dernier statut.

**Choix retenu** : une table `criminal_status_history` (statut, auteur, date), alimentée dans la même transaction que la création ou le changement de statut.

**Raison** : `updated_at` ne garde que la dernière modification ; le journal d'audit est réservé aux actions sensibles et à la direction.
