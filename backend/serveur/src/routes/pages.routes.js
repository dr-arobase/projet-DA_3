import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requirePageAuth } from '../middleware/auth.middleware.js';

const PAGES_DIR = fileURLToPath(new URL('../../public/pages/', import.meta.url));

const router = express.Router();

const page = (name) => (req, res) => res.sendFile(path.join(PAGES_DIR, `${name}.html`));

router.get('/login', page('login'));
router.get('/', requirePageAuth, page('dashboard'));
router.get('/criminals', requirePageAuth, page('criminals'));
router.get('/criminals/new', requirePageAuth, page('criminal-new'));
router.get('/criminals/:id(\\d+)', requirePageAuth, page('criminal'));

export default router;

/** Page introuvable : dernière route, après l'API et les fichiers statiques. */
export function pageNotFound(req, res) {
  res.status(404).sendFile(path.join(PAGES_DIR, 'not-found.html'));
}
