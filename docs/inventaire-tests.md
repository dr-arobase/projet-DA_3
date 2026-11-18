# Inventaire des tests (FC5)

Un test automatisé par récit terminé, et un test de refus par permission. Mis à jour le 18 novembre 2026.
Les chemins partent de `backend/serveur/tests/` (backend, Jest) ou de `frontend/src/tests/` (interface, Vitest).
La CI lance tout (`scripts/verifier-avant-push.mjs`), dont les tests sur une vraie base PostgreSQL (`integration/`).

> `routes/validation.routes.test.js` (PR #241, C38) et `unit/sockets-validation.test.js` (PR #242, FC4) arrivent avec leurs PR, encore en revue au moment de cet inventaire.

## Récit → test

| Récit | Ticket | Ce qui est vérifié | Test |
|---|---|---|---|
| 1. Connexion par matricule et mot de passe | #3 | jeton et cookie de session, mauvais mot de passe 401, compte désactivé, limite de tentatives | `routes/auth.routes.test.js`, `routes/session.routes.test.js`, `unit/login-rate-limit.middleware.test.js`, `frontend: connexion.test.jsx` |
| 2. Liste paginée du registre | #4 | page 1, 10 par défaut, OFFSET, bornes de `limit` | `routes/criminals.routes.test.js` (« GET /api/criminals »), `routes/pagination.routes.test.js` |
| 3. Profil complet d'un dossier | #5 | 200 avec le dossier, 404 | `routes/criminals.routes.test.js` (« GET /api/criminals/:id ») |
| 4. Ajouter un dossier | #6 | 201, statut de départ « recherché », journal d'audit, `criminal:added` | `routes/criminals.routes.test.js` (« POST /api/criminals »), `routes/validation.routes.test.js` |
| 5. Retirer un dossier (superviseur) | #7 | retrait, 403 pour un policier | `routes/criminals.routes.test.js`, `routes/permissions.routes.test.js` |
| 6. Mettre à jour le statut | #8 | version obligatoire, 409 si périmée, ENUM | `routes/criminals.routes.test.js` (« PATCH /api/criminals/:id/status ») |
| 7. Filtrer et rechercher | #9 | statut, nom (`q`), jokers `%` et `_` tapés tels quels | `routes/criminals.routes.test.js` |
| 8. Créer le compte d'un policier | #10 | 201, champs obligatoires, doublons 409, superviseur → policier seulement | `routes/users.routes.test.js`, `routes/validation.routes.test.js` |
| 9. Tableau de bord en temps réel | #11 | événements diffusés après l'écriture (`criminal:*`, `alert:*`) | `routes/criminals.routes.test.js`, `routes/alerts.routes.test.js`, `unit/sockets.test.js` |
| 10. Alerte urgente à tous | #12 | diffusion `alert:broadcast`, message obligatoire, policier : alerte oui, communiqué non (#202) | `routes/alerts.routes.test.js`, `integration/diffusion-longue.test.js` |
| 11. Signaler une observation | #13 | 201, lieu et notes en texte, position, 404 dossier inconnu | `routes/terrain.routes.test.js`, `routes/validation.routes.test.js` |
| 12. Agents connectés | #14 | présence par agent, mise à jour en direct | `unit/sockets.test.js`, `frontend: tempsReel.test.jsx` |
| 13. Refus si deux agents modifient le même dossier | #15 | 409 avec l'état actuel, brouillon gardé à l'écran | `routes/criminals.routes.test.js`, `integration/concurrence.test.js`, `frontend: modifierDossier.test.jsx` |
| 14. Désactiver un compte | #16 | désactivation, sockets coupés, accès refusé ensuite | `routes/users.routes.test.js`, `unit/account-status.test.js`, `routes/permissions.routes.test.js` (« compte désactivé ») |
| 15. Historique des signalements d'un dossier | #17 | réservé au superviseur, `criminal_id` vérifié | `routes/terrain.routes.test.js`, `integration/postgres.test.js` |
| 16. Journal d'audit | #18 | réservé à la direction, pagination, actions inscrites | `routes/terrain.routes.test.js`, `routes/pagination.routes.test.js`, `integration/postgres.test.js` |
| 17. Promouvoir un policier | #19 | réservé à la direction, grade permis pour le rôle | `routes/users.routes.test.js`, `routes/permissions.routes.test.js` |
| 18. Statistiques globales | #20 | tuiles, alertes du jour depuis minuit, mise à jour en direct | **`frontend: statistiques.test.jsx` (ajouté, FC5)** |
| 19. Carte des lieux | #21 | adresse placée sur la carte, adresse introuvable, signalements récents | `routes/adresses.routes.test.js`, `routes/terrain.routes.test.js`, `unit/geocoding.service.test.js` |
| R1. Coupure et reconnexion du temps réel | #120 | état hors ligne, reconnexion comptée, rattrapage ou rechargement | **`frontend: tempsReel.test.jsx` (ajouté, FC5)** |
| R2. Deux écritures simultanées | #205 | un 200 et un 409, dix en même temps, le perdant réessaie | `integration/concurrence.test.js` |
| R3. CrimeTracker en ligne | #207 | en-têtes de sécurité nginx, documentation fermée en production | `unit/nginx-csp.test.js`, `routes/api-docs-production.test.js` (le déploiement lui-même se vérifie à la main) |
| R5. Test de bout en bout à deux navigateurs | #181 | — | **trou** : pas encore dans `main` (récit d'Eric, en cours) |
| R6. Présence fiable | #206 | plusieurs onglets = une présence, départ en moins de 30 s | `unit/sockets.test.js`, `frontend: tempsReel.test.jsx` |
| PO. Modifier et retirer une diffusion | #220 | auteur ou direction, archivage, remise | `routes/alerts.routes.test.js`, `integration/diffusions-retirees.test.js`, `frontend: elementDiffusion.test.jsx` |
| Double authentification | #225 | activer, code, codes de secours, réinitialisation par la direction | `integration/deux-facteurs.test.js`, `unit/totp.test.js`, `frontend: DeuxFacteurs.test.jsx`, `frontend: utilisateurs.test.jsx` |
| Appels audio et vidéo | #56 | signalisation seulement entre agents connectés ou membres du groupe | `unit/appels.test.js`, `unit/appels-groupe.test.js`, `unit/sockets-validation.test.js` |

## Permission → test de refus

Toutes les routes de l'API sont dans le tableau `ROUTES` de `routes/permissions.routes.test.js`, qui vérifie pour chacune :
sans jeton → 401, jeton invalide → 403, compte désactivé → 401, et, pour une route réservée, chaque rôle trop bas → 403 « rôle insuffisant ».
`unit/swagger-routes.test.js` vérifie de son côté que chaque route est documentée.

| Permission | Règle | Test de refus |
|---|---|---|
| Être connecté | toute route sauf connexion, GitHub et documentation | `permissions.routes.test.js` (« sans jeton : 401 », « jeton invalide : 403 ») |
| Compte actif | un compte désactivé perd l'accès tout de suite | `permissions.routes.test.js` (« compte désactivé ») ; Socket.IO : `unit/sockets.test.js` |
| Modifier un dossier (`PUT /api/criminals/:id`) | superviseur | `permissions.routes.test.js` |
| Retirer un dossier, retirer sa photo | superviseur | `permissions.routes.test.js` (photo ajoutée, FC5), `criminal-photo.routes.test.js` |
| Historique des signalements | superviseur | `permissions.routes.test.js` |
| Lister, voir, créer, désactiver, réactiver un compte | superviseur | `permissions.routes.test.js` |
| Créer un compte superviseur ou direction | direction | `routes/users.routes.test.js` |
| Promouvoir | direction | `permissions.routes.test.js` |
| Réinitialiser la double authentification d'un agent | direction, jamais pour soi | `permissions.routes.test.js` (ajouté, FC5), `integration/deux-facteurs.test.js` |
| Journal d'audit | direction | `permissions.routes.test.js` |
| Diffuser un communiqué | superviseur | `routes/alerts.routes.test.js` (#202) |
| Modifier, retirer, remettre une diffusion | son auteur ou la direction | `routes/alerts.routes.test.js`, `integration/diffusions-retirees.test.js` |
| Modifier ou supprimer un message | son expéditeur | `routes/messages.routes.test.js` |
| Lire ou écrire dans un groupe, changer sa photo | membre du groupe | `routes/groups.routes.test.js`, `routes/group-avatar.routes.test.js` |
| Ouvrir une pièce jointe | expéditeur ou destinataire | `routes/attachments.routes.test.js` |
| Rejoindre un appel de groupe, relayer un signal | membre du groupe, participant de l'appel | `unit/appels-groupe.test.js` |

## Trous restants

- **R5 (#181)** : le test à deux navigateurs dans la CI n'est pas encore dans `main`.
- **R3 (#207)** : la mise en ligne (sauvegarde Azure #184, TURN #188) se vérifie à la main.
