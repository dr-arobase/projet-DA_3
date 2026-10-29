import * as messageModel from '../models/message.model.js';
import * as userModel from '../models/user.model.js';
import * as groupModel from '../models/group.model.js';
import { emitToUsers } from '../sockets/index.js';

export const MAX_BODY = 2000; // message.body VARCHAR(2000)

// Identifiant d'agent valide dans l'URL ou le corps, sinon null
const lireId = (valeur) => {
  const id = Number(valeur);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// GET /api/messages/contacts : agents à qui écrire, avec les non-lus
export const getContacts = async (req, res) => {
  try {
    const contacts = await messageModel.findContacts(req.user.id);
    return res.json(contacts);
  } catch (error) {
    console.error('Erreur lors de la récupération des contacts:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// GET /api/messages/unread : nombre de messages non lus (privés et de groupe), pour la pastille du menu
export const getUnreadCount = async (req, res) => {
  try {
    const total = await messageModel.countUnread(req.user.id);
    return res.json({ total });
  } catch (error) {
    console.error('Erreur lors du compte des messages non lus:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// GET /api/messages/:userId : la conversation avec un agent ; les messages reçus passent à « lus »
export const getConversation = async (req, res) => {
  const otherId = lireId(req.params.userId);
  if (!otherId) return res.status(400).json({ message: 'Identifiant d\'agent invalide' });

  try {
    const marques = await messageModel.markRead(req.user.id, otherId);
    const messages = await messageModel.findConversation(req.user.id, otherId);
    // L'expéditeur voit ses messages passer à « lu » sans recharger,
    // et la pastille du menu baisse dans tous les onglets du lecteur
    if (marques > 0) {
      emitToUsers([otherId], 'message:read', { by: req.user.id });
      emitToUsers([req.user.id], 'messages:lus', {});
    }
    return res.json(messages);
  } catch (error) {
    console.error('Erreur lors de la récupération de la conversation:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// POST /api/messages : envoyer un message privé à un agent actif
export const sendMessage = async (req, res) => {
  const recipientId = lireId(req.body.recipient_id);
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';

  if (!recipientId) return res.status(400).json({ message: 'recipient_id est obligatoire' });
  if (!body) return res.status(400).json({ message: 'Le message est vide' });
  if (body.length > MAX_BODY) {
    return res.status(400).json({ message: `Le message dépasse ${MAX_BODY} caractères` });
  }
  if (recipientId === req.user.id) {
    return res.status(400).json({ message: 'Impossible de s\'écrire à soi-même' });
  }

  try {
    const recipient = await userModel.findById(recipientId);
    if (!recipient || !recipient.is_active) {
      return res.status(404).json({ message: 'Destinataire introuvable ou désactivé' });
    }

    const message = await messageModel.create({ sender_id: req.user.id, recipient_id: recipientId, body });
    // Le destinataire et les autres onglets de l'expéditeur le reçoivent en direct
    emitToUsers([recipientId, req.user.id], 'message:new', message);
    return res.status(201).json({ message: 'Message envoyé', data: message });
  } catch (error) {
    console.error('Erreur lors de l\'envoi du message:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Agents qui voient ce message : les deux d'une conversation privée, ou les membres du groupe
async function participants(message) {
  if (!message.group_id) return [message.sender_id, message.recipient_id];
  const groupe = await groupModel.findById(message.group_id);
  return groupe ? groupe.members.map((m) => m.id) : [message.sender_id];
}

// Le message de l'URL, s'il existe, n'est pas supprimé et appartient à l'agent ; sinon répond et renvoie null
async function messageDeLAgent(req, res, action) {
  const message = await messageModel.findById(lireId(req.params.messageId));
  if (!message || message.deleted_at) {
    res.status(404).json({ message: 'Message introuvable' });
    return null;
  }
  if (message.sender_id !== req.user.id) {
    res.status(403).json({ message: `Vous ne pouvez ${action} que vos propres messages` });
    return null;
  }
  return message;
}

// PATCH /api/messages/:messageId { body } : l'expéditeur corrige son message, pendant 15 minutes (#143)
export const updateMessage = async (req, res) => {
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  if (!body) return res.status(400).json({ message: 'Le message est vide' });
  if (body.length > MAX_BODY) {
    return res.status(400).json({ message: `Le message dépasse ${MAX_BODY} caractères` });
  }

  const delaiDepasse = () => res.status(403).json({
    message: `Un message ne peut plus être modifié après ${messageModel.EDIT_WINDOW_MINUTES} minutes`,
  });

  try {
    const existant = await messageDeLAgent(req, res, 'modifier');
    if (!existant) return undefined;
    const age = Date.now() - new Date(existant.created_at).getTime();
    if (age > messageModel.EDIT_WINDOW_MINUTES * 60 * 1000) return delaiDepasse();

    // La base revérifie l'expéditeur et le délai au moment d'écrire
    const message = await messageModel.updateBody(existant.id, req.user.id, body);
    if (!message) return delaiDepasse();

    emitToUsers(await participants(message), 'message:updated', message);
    return res.json({ message: 'Message modifié', data: message });
  } catch (error) {
    console.error('Erreur lors de la modification du message:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// DELETE /api/messages/:messageId : l'expéditeur supprime son message (#144)
export const deleteMessage = async (req, res) => {
  try {
    const existant = await messageDeLAgent(req, res, 'supprimer');
    if (!existant) return undefined;

    const message = await messageModel.softDelete(existant.id, req.user.id);
    if (!message) return res.status(404).json({ message: 'Message introuvable' });

    // Chez tous les participants, le message devient « Message supprimé » et sort des non-lus
    emitToUsers(await participants(message), 'message:deleted', message);
    return res.json({ message: 'Message supprimé', data: message });
  } catch (error) {
    console.error('Erreur lors de la suppression du message:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};
