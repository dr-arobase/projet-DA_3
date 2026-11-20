# Déploiement et intégration continue (préparation de l'entretien)

Une demi-page pour expliquer, sans notes, comment une modification arrive sur le site en ligne. Décisions 16 et 18 de `03-conception.md`; commandes de la machine dans `deploy/EXPLOITATION.md`.

**1. Avant le push.** Le hook `.githooks/pre-push` lance `scripts/verifier-avant-push.mjs` : lint, audit des dépendances, tests du backend et du frontend, démarrage réel du serveur, build du frontend. Si une étape échoue, le push est refusé sur le poste du développeur.

**2. La CI sur GitHub (`ci.yml`).** À chaque PR vers `main`, deux vérifications obligatoires : les mêmes étapes que le hook sur une machine neuve, avec un vrai PostgreSQL pour les tests d'intégration, et un démarrage complet avec `docker compose` (nginx, API, base) suivi d'un essai à travers nginx. La protection de `main` exige ces deux vérifications vertes et toutes les conversations de revue résolues avant la fusion.

**3. Les images.** Après une fusion sur `main`, la CI construit deux images Docker, `crimetracker-api` (Express + Socket.IO) et `crimetracker-client` (React compilé, servi par nginx), et les publie sur le registre GitHub (ghcr.io) sous deux noms : `latest` et `sha-<7 premiers caractères du commit>`.

**4. La machine Azure.** Une machine virtuelle Ubuntu n'a que Docker, `deploy/compose.yml` et un `.env` avec les secrets (jamais dans le dépôt). Pas de code source, pas de build : elle tire les images. Toutes les 5 minutes, une tâche `cron` fait `docker compose pull` puis `up -d` : seuls les conteneurs dont l'image a changé redémarrent. Une version validée arrive donc en ligne moins de 5 minutes après la fusion, sans personne.

**5. HTTPS.** Caddy, devant nginx, obtient et renouvelle seul le certificat Let's Encrypt pour `crimetracker-da3.westus2.cloudapp.azure.com` et redirige HTTP vers HTTPS. nginx ajoute les en-têtes de sécurité (HSTS, CSP) et envoie `/api` et `/socket.io` à l'API sur le réseau privé de Docker; PostgreSQL n'a aucun port ouvert vers l'extérieur.

**6. Production différente du local, par réglages.** `COMPTE_EQUIPE=false` (pas de compte `1` / `2`), `API_DOCS=false` (Swagger fermé), `COOKIE_SECURE=true`. GitHub Pages ne sert plus qu'une redirection vers Azure.

**7. Tenir en ligne.** Sauvegarde chaque nuit (`deploy/sauvegarder.sh`, 14 gardées, restauration vérifiée par `verifier-restauration.sh`), journaux des conteneurs limités, surveillance toutes les 5 minutes (`surveillance.yml`, un ticket s'ouvre si le site tombe). Pour la remise, `TAG=sha-…` de `finale-v1` dans `.env` fige la version.

**Question probable : « Que se passe-t-il si une PR casse le site ? »** Elle ne peut pas être fusionnée si la CI est rouge. Si un bogue passe quand même, on revient en arrière en épinglant dans `.env` le `TAG=sha-…` de la version précédente, puis `docker compose up -d` : le site revient en une minute, sans reconstruire.
