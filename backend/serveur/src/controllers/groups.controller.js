import * as groupModel from '../models/group.model.js';
import { withTransaction } from '../config/db.js';
import { emitToUsers } from '../sockets/index.js';
import { MAX_BODY } from './messages.controller.js';

// Groupes de discussion (#55) : tout agent en crée un; seul le créateur ajoute ou retire
// des membres; chaque membre peut quitter. Un non-membre ne lit ni n'écrit rien (403).

export const MAX_NAME = 100; // message_group.name VARCHAR(100)
export const MAX_MEMBERS = 50;

const lireId = (valeur) => {
  const id = Number(valeur);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Liste d'ids d'agents dans le corps : entiers positifs, sans doublon ni soi-même; null si invalide
function lireMembres(valeur, moi) {
  if (!Array.isArray(valeur)) return null;
  const ids = valeur.map(lireId);
  if (ids.some((id) => id === null)) return null;
  return [...new Set(ids)].filter((id) => id !== moi);
}

const idsMembres = (groupe) => groupe.members.map((m) => m.id);

// Charge le groupe de l'URL et vérifie que l'agent en est membre; sinon répond et renvoie null
async function groupeDuMembre(req, res) {
  const groupId = lireId(req.params.groupId);
  if (!groupId) {
    res.status(400).json({ message: 'Identifiant de groupe invalide' });
    return null;
  }
  const groupe = await groupModel.findById(groupId);
  if (!groupe) {
    res.status(404).json({ message: 'Groupe introuvable' });
    return null;
  }
  if (!idsMembres(groupe).includes(req.user.id)) {
    res.status(403).json({ message: "Vous n'êtes pas membre de ce groupe" });
    return null;
  }
  return groupe;
}

// GET /api/messages/groups
export const getGroups = async (req, res) => {
  try {
    return res.json(await groupModel.findForUser(req.user.id));
  } catch (error) {
    console.error('Erreur lors de la récupération des groupes:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// POST /api/messages/groups { name, member_ids }
export const createGroup = async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const membres = lireMembres(req.body.member_ids, req.user.id);

  if (!name) return res.status(400).json({ message: 'Le nom du groupe est obligatoire' });
  if (name.length > MAX_NAME) {
    return res.status(400).json({ message: `Le nom du groupe dépasse ${MAX_NAME} caractères` });
  }
  if (!membres || membres.length === 0) {
    return res.status(400).json({ message: 'Choisissez au moins un autre agent' });
  }
  if (membres.length > MAX_MEMBERS) {
    return res.status(400).json({ message: `Un groupe compte au plus ${MAX_MEMBERS} autres membres` });
  }

  try {
    const actifs = await groupModel.findActiveUserIds(membres);
    if (actifs.length !== membres.length) {
      return res.status(400).json({ message: 'Un des agents choisis est introuvable ou désactivé' });
    }

    const groupe = await withTransaction(async (client) => {
      const id = await groupModel.create({ name, created_by: req.user.id }, client);
      await groupModel.addMembers(id, [req.user.id, ...membres], client);
      return groupModel.findById(id, client);
    });

    emitToUsers(idsMembres(groupe), 'group:updated', { group_id: groupe.id });
    return res.status(201).json(groupe);
  } catch (error) {
    console.error('Erreur lors de la création du groupe:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// GET /api/messages/groups/:groupId : les messages; le membre a tout lu
export const getGroupMessages = async (req, res) => {
  try {
    const groupe = await groupeDuMembre(req, res);
    if (!groupe) return undefined;
    await groupModel.markRead(groupe.id, req.user.id);
    const messages = await groupModel.findMessages(groupe.id);
    // La pastille du menu baisse dans tous les onglets du lecteur
    emitToUsers([req.user.id], 'messages:lus', {});
    return res.json({ group: groupe, messages });
  } catch (error) {
    console.error('Erreur lors de la lecture du groupe:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// POST /api/messages/groups/:groupId/messages { body }
export const sendGroupMessage = async (req, res) => {
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  if (!body) return res.status(400).json({ message: 'Le message est vide' });
  if (body.length > MAX_BODY) {
    return res.status(400).json({ message: `Le message dépasse ${MAX_BODY} caractères` });
  }

  try {
    const groupe = await groupeDuMembre(req, res);
    if (!groupe) return undefined;
    const message = await groupModel.createMessage({ sender_id: req.user.id, group_id: groupe.id, body });
    emitToUsers(idsMembres(groupe), 'group:message', message);
    return res.status(201).json({ message: 'Message envoyé', data: message });
  } catch (error) {
    console.error("Erreur lors de l'envoi au groupe:", error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// POST /api/messages/groups/:groupId/members { member_ids } : créateur seulement
export const addGroupMembers = async (req, res) => {
  const membres = lireMembres(req.body.member_ids, req.user.id);
  if (!membres || membres.length === 0) {
    return res.status(400).json({ message: 'Choisissez au moins un agent à ajouter' });
  }

  try {
    const groupe = await groupeDuMembre(req, res);
    if (!groupe) return undefined;
    if (groupe.created_by !== req.user.id) {
      return res.status(403).json({ message: 'Seul le créateur du groupe peut ajouter des membres' });
    }
    if (new Set([...idsMembres(groupe), ...membres]).size > MAX_MEMBERS + 1) {
      return res.status(400).json({ message: `Un groupe compte au plus ${MAX_MEMBERS + 1} membres` });
    }
    const actifs = await groupModel.findActiveUserIds(membres);
    if (actifs.length !== membres.length) {
      return res.status(400).json({ message: 'Un des agents choisis est introuvable ou désactivé' });
    }

    await groupModel.addMembers(groupe.id, membres);
    const misAJour = await groupModel.findById(groupe.id);
    emitToUsers(idsMembres(misAJour), 'group:updated', { group_id: groupe.id });
    return res.json(misAJour);
  } catch (error) {
    console.error("Erreur lors de l'ajout de membres:", error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// DELETE /api/messages/groups/:groupId/members/:userId : le créateur retire un membre,
// ou un membre se retire lui-même (quitter le groupe)
export const removeGroupMember = async (req, res) => {
  const cible = lireId(req.params.userId);
  if (!cible) return res.status(400).json({ message: "Identifiant d'agent invalide" });

  try {
    const groupe = await groupeDuMembre(req, res);
    if (!groupe) return undefined;
    const quitter = cible === req.user.id;
    if (!quitter && groupe.created_by !== req.user.id) {
      return res.status(403).json({ message: 'Seul le créateur du groupe peut retirer des membres' });
    }
    if (!idsMembres(groupe).includes(cible)) {
      return res.status(404).json({ message: "Cet agent n'est pas membre du groupe" });
    }

    const gestionnaire = await withTransaction(async (client) => {
      await groupModel.removeMember(groupe.id, cible, client);
      // Le créateur quitte : le membre le plus ancien prend la relève (ou le groupe disparaît)
      return cible === groupe.created_by
        ? groupModel.transferOrDelete(groupe.id, client)
        : groupe.created_by;
    });

    // Les anciens membres (dont celui qui part) mettent leur liste à jour
    emitToUsers(idsMembres(groupe), 'group:updated', { group_id: groupe.id });
    return res.json({ message: quitter ? 'Vous avez quitté le groupe' : 'Membre retiré', created_by: gestionnaire });
  } catch (error) {
    console.error("Erreur lors du retrait d'un membre:", error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};
