import express from 'express';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Import des routes
import authRoutes from './routes/auth.routes.js';
import criminalsRoutes from './routes/criminals.routes.js';
// import alertsRoutes from './routes/alerts.routes.js';
// import sightingsRoutes from './routes/sightings.routes.js';
// import usersRoutes from './routes/users.routes.js';
// import auditLogsRoutes from './routes/auditLogs.routes.js';

// Import des middlewares globaux
import { errorHandler } from './middleware/error.middleware.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Chargement de la documentation OpenAPI / Swagger depuis docs/api.yaml
const swaggerDocument = YAML.load(path.join(__dirname, '../docs/api.yaml'));

const app = express();

// Middlewares de parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Documentation Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Enregistrement des routes de l'API
app.use('/api/auth', authRoutes);
app.use('/api/criminals', criminalsRoutes);
// app.use('/api/alerts', alertsRoutes);
// app.use('/api/sightings', sightingsRoutes);
// app.use('/api/users', usersRoutes);
// app.use('/api/audit-logs', auditLogsRoutes);

// Route racine de vérification
app.get('/', (req, res) => {
  res.json({
    message: 'API CrimeTracker opérationnelle',
    documentation: '/api-docs'
  });
});

// Middleware global de gestion des erreurs (doit être placé en dernier)
app.use(errorHandler);

export default app;