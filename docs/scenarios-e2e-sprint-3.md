# Scénarios de test bout en bout — sprint 3

Ces scénarios sont destinés à la revue avec Eric (E19). Ils utilisent deux navigateurs isolés sur `http://localhost:8080`.

## 1. Temps réel entre deux rôles

1. Navigateur A : se connecter avec `1` / `2` (direction).
2. Navigateur B : se connecter avec `PL-004` / `Alpha2026!` (policier).
3. A ouvre une conversation avec B et envoie un message.
4. Vérifier que B reçoit le message sans recharger.
5. A diffuse une alerte urgente; vérifier l’apparition du bandeau sur B.

## 2. Autorisation et erreur sur place

1. Dans B, ouvrir un dossier et modifier son statut.
2. Depuis A, vérifier qu’un policier ne voit pas les fonctions réservées à la direction.
3. Simuler une modification d’un message de plus de 15 minutes.
4. Vérifier que le message « ne peut plus être modifié » reste dans la messagerie et ne redirige pas vers `/connexion`.

## 3. Parcours mobile

1. Ouvrir le registre, l’annuaire et la carte à 320 px.
2. Vérifier l’absence de défilement horizontal.
3. Vérifier les cibles tactiles des boutons et la visibilité du focus clavier.
4. Saisir un nom dans la recherche de l’accueil et ouvrir un résultat proposé.
