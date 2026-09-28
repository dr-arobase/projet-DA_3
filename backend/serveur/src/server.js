import app from './app.js';
import dotenv from 'dotenv';
import { initializeDatabase } from './config/db.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    if (initializeDatabase) {
      await initializeDatabase();
    }

    const server = app.listen(PORT, () => {
      console.log(`Serveur démarré sur http://localhost:${PORT}`);
    });
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Le port ${PORT} est déjà utilisé.`);
        console.error(`→ Fermez l'autre serveur ou changez PORT= dans .env`);
      } else {
        console.error('Erreur serveur:', err);
      }
      process.exit(1);
    });

  } catch (error) {
    console.error('Erreur au démarrage du serveur:', error);
    process.exit(1);
  }
}

startServer();