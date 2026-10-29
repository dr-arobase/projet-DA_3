import express from 'express';
import {
  getContacts, getUnreadCount, getConversation, sendMessage, updateMessage, deleteMessage,
  sendAttachment, getAttachment,
} from '../controllers/messages.controller.js';
import { readAttachment } from '../middleware/attachment.middleware.js';
import {
  getGroups, createGroup, getGroupMessages, sendGroupMessage, addGroupMembers, removeGroupMember,
} from '../controllers/groups.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { validateId } from '../middleware/validateId.middleware.js';

const router = express.Router();

// Messagerie privée : tout agent connecté
router.use(verifyToken);

router.get('/contacts', getContacts);
// Avant /:userId, sinon « unread » serait pris pour un identifiant d'agent
router.get('/unread', getUnreadCount);

// Groupes : avant /:userId, sinon « groups » serait pris pour un identifiant d'agent.
// L'appartenance au groupe (et le rôle de créateur) est vérifiée dans le contrôleur.
router.get('/groups', getGroups);
router.post('/groups', createGroup);
router.get('/groups/:groupId', getGroupMessages);
router.post('/groups/:groupId/messages', sendGroupMessage);
router.post('/groups/:groupId/members', addGroupMembers);
router.delete('/groups/:groupId/members/:userId', removeGroupMember);

// Fichiers, images, GIF et messages vocaux : envoi en corps brut, lecture réservée aux participants
router.post('/attachments', readAttachment, sendAttachment);
router.get('/:messageId/attachment', getAttachment);

router.get('/:userId', getConversation);
router.post('/', sendMessage);

// Un message précis (privé ou de groupe) : seul son expéditeur le modifie (15 minutes) ou le supprime
router.patch('/:messageId', updateMessage);
router.delete('/:messageId', deleteMessage);

// Tout identifiant de l'URL doit être un entier positif (sinon 400)
router.param('groupId', validateId);
router.param('userId', validateId);
router.param('messageId', validateId);
export default router;
