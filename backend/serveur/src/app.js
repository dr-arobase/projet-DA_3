import express from 'express';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {authenticate} from './middleware/auth.middleware.js';
import { requireRole } from './middleware/rbac.middleware.js';

// Import des routes
import authRoutes from './routes/auth.js';
import criminalsRoutes from './routes/criminals.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const swaggerDocument = JSON.parse(fs.readFileSync(path.join(__dirname, 'swagger.json'), 'utf8'));

const app = express();

app.use(express.json());

// Routes Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes de l'API
app.use('/auth', authRoutes);
app.get('/auth/me', authenticate, (req, res)=> res.json({user: req.user}));
app.use('/api/criminals', criminalsRoutes);

app.get('/', (req, res) => {
  res.send('Serveur CrimeTracker opérationnel ! Allez sur /api-docs pour voir le Swagger.');
});

// TEMPORAIRE : uniquement pour tester le contrôle des rôles, à supprimer ensuite
app.get('/api/test-direction', authenticate, requireRole('direction'), (req, res) => {
  res.json({ message: 'Accès direction OK' });
});

export default app;
