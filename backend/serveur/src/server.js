import 'dotenv/config';
import app from './app.js';
import { initializeDatabase } from './config/db.js';
import { logger } from './utils/logger.js';

const PORT = process.env.PORT || 3000;

async function startServer() {
  if (!process.env.JWT_SECRET) {
    throw new Error('La variable d\'environnement JWT_SECRET est requise (voir .env.example).');
  }

  await initializeDatabase();

  const server = app.listen(PORT, () => {
    logger.info(`CrimeTracker démarré sur http://localhost:${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Le port ${PORT} est déjà utilisé : fermez l'autre serveur ou changez PORT dans .env.`);
    } else {
      logger.error('Erreur serveur :', err);
    }
    process.exit(1);
  });
}

startServer().catch((err) => {
  logger.error('Échec du démarrage :', err);
  process.exit(1);
});
