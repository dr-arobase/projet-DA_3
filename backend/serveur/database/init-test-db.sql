-- Exécuté par l'image postgres au tout premier démarrage (volume vide) :
-- une base séparée pour les tests, qui la vident et la recréent à chaque exécution.
CREATE DATABASE crimetracker_test OWNER crimetracker;
