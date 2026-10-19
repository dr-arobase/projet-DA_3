import express from 'express';
import { getContacts, getConversation, sendMessage } from '../controllers/messages.controller.js';
import {
  getGroups, createGroup, getGroupMessages, sendGroupMessage, addGroupMembers, removeGroupMember,
} from '../controllers/groups.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Messagerie privée : tout agent connecté
router.use(verifyToken);

router.get('/contacts', getContacts);

// Groupes : avant /:userId, sinon « groups » serait pris pour un identifiant d'agent.
// L'appartenance au groupe (et le rôle de créateur) est vérifiée dans le contrôleur.
router.get('/groups', getGroups);
router.post('/groups', createGroup);
router.get('/groups/:groupId', getGroupMessages);
router.post('/groups/:groupId/messages', sendGroupMessage);
router.post('/groups/:groupId/members', addGroupMembers);
router.delete('/groups/:groupId/members/:userId', removeGroupMember);

router.get('/:userId', getConversation);
router.post('/', sendMessage);

export default router;
