# Présentation orale — déroulé

L'énoncé : « Vous présentez votre projet devant la classe comme s'il s'agissait d'une présentation devant un **nouveau** client » (7 % de la note). Il ne fixe ni la durée ni l'ordre : l'équipe vise **10 minutes**, puis les questions.

Règle pour tous : on parle à un client, pas à un correcteur. On montre ce que le produit fait pour un service de police, sur le **site en ligne**, et on évite le vocabulaire de programmeur (pas de « route », « contrôleur », « JWT » sans l'expliquer en une phrase).

## Avant de commencer (la veille et 10 minutes avant)

- Le site en ligne roule `finale-v1` (voir `deploy/EXPLOITATION.md`, étape 9).
- Deux navigateurs ouverts sur l'ordinateur de la classe, connectés avec deux comptes de démonstration : `PO-001` (direction) et `PL-003` (policier), mot de passe `Alpha2026!`. Un téléphone connecté avec `PL-004`.
- Données de démonstration chargées (13 dossiers fictifs, `demo.sql`).
- Plan B si le réseau du collège tombe : `docker compose up` sur un portable, mêmes comptes.

## Déroulé

| Temps | Qui | Sujet | Ce qu'on montre |
|---|---|---|---|
| 0:00–2:00 | **Massyle** | Le problème et le produit; où il tourne | Le besoin : des agents sur le terrain qui doivent savoir tout de suite qui est recherché. Ouvrir le site en ligne au téléphone et à l'ordinateur : même adresse, HTTPS, connexion avec GitHub ou un compte de service. En une phrase : le site se met à jour seul à chaque version validée, il est sauvegardé chaque nuit et surveillé toutes les 5 minutes. |
| 2:00–4:00 | **Chrysler** | Le registre et deux agents qui modifient le même dossier | Ouvrir une fiche dans les deux navigateurs, changer l'adresse dans le premier, puis dans le second : le second voit « ce dossier a changé » avec l'état actuel, rien n'est écrasé. |
| 4:00–6:00 | **Michael** | Le terrain : téléphone et temps réel | Le registre en cartes sur le téléphone; une alerte urgente diffusée par le policier arrive en direct sur l'ordinateur; couper le Wi-Fi du téléphone : le bandeau de coupure s'affiche, puis l'appareil rattrape ce qui a été manqué. |
| 6:00–8:00 | **Eric** | Sécurité et fiabilité | Un policier essaie de publier un communiqué : refusé, avec un message clair. La double authentification activée sur un compte (code demandé à la connexion). Les actions sensibles sont inscrites au journal d'audit. |
| 8:00–9:30 | **Massyle** | Comment l'équipe a travaillé; ce qui reste | Le plan de l'équipe en ligne : chaque tâche a un responsable, une échéance et un critère « Terminé quand », et n'est cochée que si elle est vraiment dans le code et sur le site; une page de tâches par personne; le tableau du Project et le message du mercredi sur les retards. Puis la section « Ce qui est simulé » du README, dite franchement (mot de passe oublié), et deux idées de la boîte à idées pour la suite. |
| 9:30–10:00 | **Massyle** | Conclusion | Une phrase : ce que le client gagne. On invite les questions. |

**Questions** : chacun répond sur sa partie; Massyle redirige.

## Répétition

Une répétition complète, chronométrée, avant le point de contrôle du 27 novembre. Noter au journal la durée réelle et ce qu'on change.

| Date | Durée réelle | Ce qu'on change |
|---|---|---|
| | | |
