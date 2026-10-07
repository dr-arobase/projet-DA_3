import { Server } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';
import { tokenFrom } from '../utils/session.js';

let io;

// Présence : un policier peut avoir plusieurs connexions (plusieurs onglets), on garde par socket.id
const connectedUsers = new Map();

function getPresenceList() {
  return Array.from(connectedUsers.values());
}

export default function registerSockets(server) {
  io = new Server(server, {
    cors: { origin: '*' }
  });

  // Authentification au moment de la connexion, via le même jeton JWT que l'API
  io.use((socket, next) => {
    try {
      // Jeton passé explicitement (scripts) ou cookie de session (navigateur)
      const token = socket.handshake.auth?.token || tokenFrom(socket.handshake.headers);
      if (!token) throw new Error('Jeton manquant');
      socket.user = verifyToken(token);
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