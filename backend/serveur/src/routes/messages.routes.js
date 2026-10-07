import express from 'express';
import { getContacts, getConversation, sendMessage } from '../controllers/messages.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Messagerie privée : tout agent connecté
router.use(verifyToken);

router.get('/contacts', getContacts);
router.get('/:userId', getConversation);
router.post('/', sendMessage);

export default router;
