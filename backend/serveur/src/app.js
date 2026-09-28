import express from 'express';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import authRoutes from './routes/auth.routes.js';
import criminalsRoutes from './routes/criminals.routes.js';
import pagesRoutes, { pageNotFound } from './routes/pages.routes.js';
import { apiNotFound, errorHandler } from './middleware/error.middleware.js';

const swaggerDocument = JSON.parse(fs.readFileSync(new URL('./swagger.json', import.meta.url), 'utf8'));
const ASSETS_DIR = fileURLToPath(new URL('../public/assets/', import.meta.url));

const app = express();

app.use(express.json());
app.use(cookieParser());

// Documentation interactive de l'API
app.get('/api-docs.json', (req, res) => res.json(swaggerDocument));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, { swaggerOptions: { withCredentials: true } }));

// API
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/auth', authRoutes);
app.use('/api/criminals', criminalsRoutes);
app.use(['/api', '/auth'], apiNotFound);

// Interface web
app.use('/assets', express.static(ASSETS_DIR));
app.use(pagesRoutes);
app.use(pageNotFound);

app.use(errorHandler);

export default app;
