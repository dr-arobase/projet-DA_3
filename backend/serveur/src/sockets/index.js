import { Server } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';
import { tokenFrom } from '../utils/session.js';
import { getAccountAuthInfo } from '../utils/account-status.js';
import { getAllowedOrigins } from '../utils/allowed-origins.js';
import { registerCallHandlers, livrerAppelsEnAttente } from './appels.js';
import { registerGroupCallHandlers } from './appels-groupe.js';
import * as groupModel from '../models/group.model.js';
import * as messageModel from '../models/message.model.js';
import * as userModel from '../models/user.model.js';

let io;

// Présence (#206) : une entrée par agent, quel que soit son nombre d'onglets.
// Pour chaque agent, on garde l'ensemble de ses connexions ouvertes (socket.id) :
// il reste « en ligne » tant qu'il lui en reste au moins une.
const presences = new Map();

function getPresenceList() {
  return Array.from(presences.values(), (p) => p.agent);
}

// Renvoie true si l'agent vient d'apparaître (premier onglet)
function ajouterConnexion(socket) {
  const { id, badge_number, role, grade } = socket.user;
  const presence = presences.get(id);
  if (presence) {
    presence.sockets.add(socket.id);
    return false;
  }
  presences.set(id, { agent: { id, badge_number, role, grade }, sockets: new Set([socket.id]) });
  return true;
}

// Renvoie true si l'agent vient de disparaître (dernier onglet fermé)
function retirerConnexion(socket) {
  const presence = presences.get(socket.user.id);
  if (!presence) return false;
  presence.sockets.delete(socket.id);
  if (presence.sockets.size > 0) return false;
  presences.delete(socket.user.id);
  return true;
}

// Connexion coupée sans au revoir (onglet planté, réseau perdu, ordinateur en veille) :
// le serveur envoie un ping toutes les PING_INTERVAL ms et attend la réponse PING_TIMEOUT ms.
// Sans réponse, la connexion est fermée et l'agent retiré de la présence.
// Pire cas : Engine.IO prolonge une fois l'attente si un autre paquet arrive, d'où 2 × PING_TIMEOUT.
// Les valeurs par défaut de Socket.IO (25 s + 20 s) dépassaient les 30 s du récit R6.
export const PING_INTERVAL = 10_000;
export const PING_TIMEOUT = 5_000;
export const DELAI_MAX_DISPARITION = PING_INTERVAL + 2 * PING_TIMEOUT; // 20 s

export default function registerSockets(server, { pingInterval = PING_INTERVAL, pingTimeout = PING_TIMEOUT } = {}) {
  const allowedOrigins = getAllowedOrigins();
  io = new Server(server, {
    cors: { origin: allowedOrigins, credentials: true },
    pingInterval,
    pingTimeout,
    connectionStateRecovery: {
      maxDisconnectionDuration: 30_000,
      skipMiddlewares: false,
    },
  });

  // Authentification au moment de la connexion, via le même jeton JWT que l'API
  io.use(async (socket, next) => {
    try {
      // Jeton passé explicitement (scripts) ou cookie de session (navigateur)
      const origin = socket.handshake.headers.origin;
      if (origin && !allowedOrigins.includes(origin)) throw new Error('Origine non autorisée');
      const token = socket.handshake.auth?.token || tokenFrom(socket.handshake.headers);
      if (!token) throw new Error('Jeton manquant');
      const decoded = verifyToken(token);
      const account = await getAccountAuthInfo(decoded.id);
      if (!account?.is_active) throw new Error('Compte désactivé');
      socket.user = {
        id: account.id,
        badge_number: account.badge_number,
        role: account.role,
        grade: account.grade,
      };
      next();
    } catch {
      next(new Error('Authentification Socket.IO échouée'));
    }
  });

  io.on('connection', (socket) => {
    const { id } = socket.user;
    // Salle privée de l'agent (tous ses onglets) : messages destinés à lui seul
    socket.join(roomOf(id));
    // Nouvel agent : tout le monde est prévenu. Nouvel onglet d'un agent déjà là :
    // la liste ne change pas, seul ce nouvel onglet la reçoit.
    if (ajouterConnexion(socket)) io.emit('presence:update', getPresenceList());
    else socket.emit('presence:update', getPresenceList());

    // Appels audio et vidéo : signalisation relayée seulement entre agents connectés (#56)
    const envoyerA = (userId, event, payload) => io.to(roomOf(userId)).emit(event, payload);
    registerCallHandlers(socket, {
      estConnecte: (userId) => presences.has(userId),
      envoyerA,
      // Appel resté sans réponse : un message dans la conversation, vu à la prochaine connexion
      laisserAppelManque: async ({ fromId, toId, video }) => {
        const destinataire = await userModel.findById(toId);
        if (!destinataire?.is_active) return;
        const message = await messageModel.createEvent({
          sender_id: fromId,
          recipient_id: toId,
          kind: video ? 'appel-manque-video' : 'appel-manque-audio',
          body: `Appel ${video ? 'vidéo' : 'audio'} manqué`,
        });
        emitToUsers([toId, fromId], 'message:new', message);
      },
    });
    // Appels de groupe : seulement entre membres du groupe, 6 participants au plus
    registerGroupCallHandlers(socket, { estMembre: groupModel.isMember, groupe: groupModel.findById, envoyerA });
    // Un appel qui lui est destiné sonne encore (il était hors ligne) : il le reçoit maintenant
    livrerAppelsEnAttente(id, envoyerA);

    // Fermer un onglet parmi plusieurs ne change rien ; fermer le dernier retire l'agent tout de suite
    socket.on('disconnect', () => {
      if (retirerConnexion(socket)) io.emit('presence:update', getPresenceList());
    });
  });

  return io;
}

// Utilisé par les contrôleurs pour diffuser un événement, après un COMMIT réussi en base
export function emitEvent(event, payload) {
  if (io) io.emit(event, payload);
}

const roomOf = (userId) => `agent:${userId}`;

// Envoie un événement aux seuls agents indiqués (ex. un message privé : destinataire et expéditeur)
export function emitToUsers(userIds, event, payload) {
  if (io) io.to([...new Set(userIds)].map(roomOf)).emit(event, payload);
}

export function disconnectUser(userId) {
  if (io) io.in(roomOf(userId)).disconnectSockets(true);
}