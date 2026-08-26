# Plan des trois sprints — CrimeTracker

---

## Sprint 1 — Alpha (~3 semaines)

**Objectif** : L'application fonctionne de bout en bout — un agent peut se connecter, consulter et gérer le registre des personnes recherchées, le tout dans un environnement conteneurisé avec une chaîne CI verte.

**Incrément démontrable** : démo en direct où on se connecte, on ajoute un criminel, on met à jour son statut et on le retire — depuis Docker sur n'importe quelle machine.

### Récits prévus

| # | Récit | Points |
|---|---|---|
| 1 | S'authentifier avec badge et mot de passe | 5 |
| 2 | Consulter la liste des personnes recherchées | 2 |
| 3 | Voir le profil complet d'un dossier | 3 |
| 4 | Ajouter un nouveau dossier (superviseur) | 5 |
| 5 | Retirer un dossier (superviseur) | 3 |
| 6 | Mettre à jour le statut d'un dossier | 3 |
| 7 | Filtrer et rechercher les dossiers | 3 |
| **Total** | | **24 pts** |

### Capacité

- 4 membres × 4 h/semaine (hors cours) × 3 semaines = **48 heures**
- Référence : 1 point ≈ 2 h de travail effectif → **capacité estimée : 24 points**
- On vise 24 points — plan tendu mais réaliste si on ne dévie pas.

### Notions disponibles
Docker, PostgreSQL, React Router v7 (SSR), tests et CI/GitHub Actions.

---

## Sprint 2 — Beta (~3 semaines)

**Objectif** : Les rôles et autorisations sont réellement appliqués, et la première version du tableau de bord temps réel est fonctionnelle — les agents voient les changements en direct.

**Incrément démontrable** : deux navigateurs ouverts côte à côte — quand un superviseur ajoute un dossier dans l'un, il apparaît dans l'autre en moins d'une seconde. Une alerte urgente diffusée dans l'un s'affiche dans l'autre instantanément.

### Récits prévus

| # | Récit | Points |
|---|---|---|
| 8 | Créer le compte d'un nouvel agent | 3 |
| 14 | Désactiver un compte agent | 2 |
| 9 | Tableau de bord temps réel (alertes et mises à jour) | 8 |
| 10 | Diffuser une alerte urgente | 5 |
| 11 | Signaler une observation terrain | 5 |
| **Total** | | **23 pts** |

### Notions disponibles
Authentification externe (OAuth 2 / OIDC), rôles et autorisations, programmation sécurisée, protocole WebSocket / Socket.IO (début).

---

## Sprint 3 — Version finale (~5 semaines)

**Objectif** : Le temps réel est complet (présence, resynchronisation après déconnexion), la concurrence est gérée correctement, et l'application est déployée sur un serveur public.

**Incrément démontrable** : deux onglets tentent de marquer le même criminel comme « capturé » simultanément — un réussit, l'autre reçoit un message d'erreur avec l'état actuel. L'application est accessible en ligne.

### Récits prévus

| # | Récit | Points |
|---|---|---|
| 12 | Voir les agents connectés en temps réel | 3 |
| 13 | Gestion de la concurrence (verrouillage optimiste) | 8 |
| 15 | Historique des signalements sur un dossier | 3 |
| 16 | Journal d'audit des actions sensibles | 5 |
| 17 | Statistiques globales (Could) | 5 |
| + | Déploiement, peaufinage, tests e2e | — |
| **Total** | | **~24 pts** |

### Notions disponibles
Socket.IO (présence, état partagé), gestion de la concurrence, déploiement.

---

## Ordre d'abandon

Si l'équipe prend du retard, voici l'ordre dans lequel on coupe — décidé maintenant, à froid :

1. **Statistiques globales** (#17, `Could`) — aucune valeur fonctionnelle pour la correction
2. **Journal d'audit** (#16, `Should`) — utile mais non démontrable facilement
3. **Historique des signalements** (#15, `Should`) — le signalement reste, l'historique saute
4. **Désactivation de compte** (#14, `Should`) — on garde la création de compte
5. **Filtre avancé** (#7) — on conserve la recherche par nom, on retire les filtres secondaires

On ne coupe jamais : authentification, registre de base, tableau de bord temps réel, gestion de la concurrence. Ce sont les récits `Must` qui définissent l'application.
