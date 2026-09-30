import app from './app.js';
import dotenv from 'dotenv';
import { initializeDatabase } from './config/db.js';
import registerSockets from './sockets/index.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Initialisation du pool ou des tables si nécessaire
    if (typeof initializeDatabase === 'function') {
      await initializeDatabase();
    }

    const server = app.listen(PORT, () => {
      console.log(`Serveur CrimeTracker démarré sur http://localhost:${PORT}`);
      console.log(`Documentation Swagger disponible sur http://localhost:${PORT}/api-docs`);
    });
    
    // Socket.IO partage le même serveur HTTP que l'API (suivi en temps réel)
    registerSockets(server);

    // Gestion propre des erreurs d'écoute (ex: port déjà utilisé)
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Le port ${PORT} est déjà utilisé.`);
        console.error(`→ Fermez l'autre process ou modifiez la variable PORT dans le fichier .env`);
      } else {
        console.error('Erreur au niveau du serveur HTTP:', err);
      }
      process.exit(1);
    });

  } catch (error) {
    console.error('Erreur critique au démarrage du serveur:', error);
    process.exit(1);
  }
}

startServer();