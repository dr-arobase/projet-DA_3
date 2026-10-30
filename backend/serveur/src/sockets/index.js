import { Server } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';
import { tokenFrom } from '../utils/session.js';
import { getAccountAuthInfo } from '../utils/account-status.js';
import { getAllowedOrigins } from '../utils/allowed-origins.js';
import { registerCallHandlers } from './appels.js';

let io;

// Présence : un policier peut avoir plusieurs connexions (plusieurs onglets), on garde par socket.id
const connectedUsers = new Map();

function getPresenceList() {
  return Array.from(connectedUsers.values());
}

export default function registerSockets(server) {
  const allowedOrigins = getAllowedOrigins();
  io = new Server(server, {
    cors: { origin: allowedOrigins, credentials: true }
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
    const { id, badge_number, role, grade } = socket.user;
    connectedUsers.set(socket.id, { id, badge_number, role, grade });
    // Salle privée de l'agent (tous ses onglets) : messages destinés à lui seul
    socket.join(roomOf(id));
    io.emit('presence:update', getPresenceList());

    // Appels audio et vidéo : signalisation relayée seulement entre agents connectés (#56)
    registerCallHandlers(socket, {
      estConnecte: (userId) => getPresenceList().some((p) => p.id === userId),
      envoyerA: (userId, event, payload) => io.to(roomOf(userId)).emit(event, payload),
    });

    socket.on('disconnect', () => {
      connectedUsers.delete(socket.id);
      io.emit('presence:update', getPresenceList());
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