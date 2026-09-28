// Exécuté avant chaque fichier de test, avant tout import de l'application.
process.env.JWT_SECRET ??= 'secret-reserve-aux-tests';
process.env.DATABASE_URL ??= 'postgres://crimetracker:crimetracker@localhost:5432/crimetracker_test';
