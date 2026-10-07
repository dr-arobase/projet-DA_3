import * as messageModel from '../models/message.model.js';
import * as userModel from '../models/user.model.js';
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

// GET /api/messages/:userId : la conversation avec un agent ; les messages reçus passent à « lus »
export const getConversation = async (req, res) => {
  const otherId = lireId(req.params.userId);
  if (!otherId) return res.status(400).json({ message: 'Identifiant d\'agent invalide' });

  try {
    const marques = await messageModel.markRead(req.user.id, otherId);
    const messages = await messageModel.findConversation(req.user.id, otherId);
    // L'expéditeur voit ses messages passer à « lu » sans recharger
    if (marques > 0) emitToUsers([otherId], 'message:read', { by: req.user.id });
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
