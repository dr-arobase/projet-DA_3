import express from 'express';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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
app.use('/api/criminals', criminalsRoutes);

app.get('/', (req, res) => {
  res.send('Serveur CrimeTracker opérationnel ! Allez sur /api-docs pour voir le Swagger.');
});

export default app;
