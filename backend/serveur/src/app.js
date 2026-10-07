import express from 'express';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Charger les variables d'environnement (.env)
dotenv.config();

// Import des routes
import authRoutes from './routes/auth.routes.js';
import criminalsRoutes from './routes/criminals.routes.js';
import usersRoutes from './routes/users.routes.js';
import sightingsRoutes from './routes/sightings.routes.js';
import alertsRoutes from './routes/alerts.routes.js';
import auditLogsRoutes from './routes/auditLogs.routes.js';
import messagesRoutes from './routes/messages.routes.js';

// Import des middlewares globaux
import { errorHandler } from './middleware/error.middleware.js';
import { verifyToken } from './middleware/auth.middleware.js';
import { UPLOADS_DIR } from './middleware/upload.middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Chargement de la documentation OpenAPI / Swagger depuis swagger.json
const swaggerDocument = JSON.parse(fs.readFileSync(path.join(__dirname, 'swagger.json'), 'utf8'));

const app = express();

// Middlewares de parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serveur Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Enregistrement des routes de l'API
app.use('/api/auth', authRoutes);
app.use('/api/criminals', criminalsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/sightings', sightingsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/audit-logs', auditLogsRoutes);
app.use('/api/messages', messagesRoutes);

// Fichiers envoyés (photos de profil) : réservés aux agents connectés.
// Le navigateur envoie le cookie de session tout seul pour les <img> de même origine.
app.use('/api/uploads', verifyToken, express.static(UPLOADS_DIR, { fallthrough: false }));

// Route d'accueil / de test
app.get('/', (req, res) => {
  res.json({
    message: 'API CrimeTracker opérationnelle',
    documentation: '/api-docs'
  });
});

// Middleware global de gestion des erreurs
app.use(errorHandler);

export default app;