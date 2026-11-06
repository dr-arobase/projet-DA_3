// Appels audio et vidéo de groupe, jusqu'à MAX_PARTICIPANTS agents d'un même groupe de discussion.
// Chaque participant se connecte directement à chacun des autres (WebRTC « maillé ») : le son et l'image
// ne passent jamais par le serveur. Le serveur garde seulement qui est dans l'appel de chaque groupe,
// vérifie que chacun est membre du groupe, et relaie la signalisation entre deux participants.
//
// Déroulement : le premier qui rejoint lance l'appel (les autres membres connectés sont prévenus);
// chaque nouvel arrivant reçoit la liste des participants et leur envoie une offre; quand le dernier
// part, l'appel se termine.
import { nettoyerSignal } from './appels.js';

export const MAX_PARTICIPANTS = 6;

// groupId -> Map(userId -> { video, socketId })
const appels = new Map();

// Pour les tests
export function oublierAppelsDeGroupe() { appels.clear(); }

const lireId = (valeur) => {
  const id = Number(valeur);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// estMembre(groupId, userId) -> Promise<boolean>
// groupe(groupId) -> Promise<{ id, name, members: [{ id }] } | null>
// envoyerA(userId, événement, données) : à tous les onglets d'un agent
export function registerGroupCallHandlers(socket, { estMembre, groupe, envoyerA }) {
  const moi = socket.user;
  const repondre = (ack, resultat) => { if (typeof ack === 'function') ack(resultat); };

  async function quitter(groupId) {
    const participants = appels.get(groupId);
    // Seul l'onglet qui a rejoint fait partir l'agent (un autre onglet qui se ferme ne compte pas)
    if (!participants || participants.get(moi.id)?.socketId !== socket.id) return;
    participants.delete(moi.id);
    socket.data.appelGroupe = null;
    for (const id of participants.keys()) envoyerA(id, 'group-call:left', { groupId, userId: moi.id });
    if (participants.size === 0) {
      appels.delete(groupId);
      const g = await groupe(groupId).catch(() => null);
      for (const m of g?.members ?? []) envoyerA(m.id, 'group-call:ended', { groupId });
    }
  }

  // Rejoindre (ou lancer) l'appel d'un groupe dont on est membre
  socket.on('group-call:join', async (payload, ack) => {
    const groupId = lireId(payload?.groupId);
    if (!groupId) return repondre(ack, { error: 'Groupe invalide' });
    try {
      if (!(await estMembre(groupId, moi.id))) return repondre(ack, { error: 'Vous n\'êtes pas membre de ce groupe' });
      if (socket.data.appelGroupe && socket.data.appelGroupe !== groupId) await quitter(socket.data.appelGroupe);

      const participants = appels.get(groupId) ?? new Map();
      if (!participants.has(moi.id) && participants.size >= MAX_PARTICIPANTS) {
        return repondre(ack, { error: `L'appel est complet (${MAX_PARTICIPANTS} participants au plus)` });
      }
      const autres = [...participants.keys()].filter((id) => id !== moi.id);
      const video = payload.video === true;
      participants.set(moi.id, { video, socketId: socket.id });
      appels.set(groupId, participants);
      socket.data.appelGroupe = groupId;

      repondre(ack, { ok: true, participants: autres });
      for (const id of autres) envoyerA(id, 'group-call:joined', { groupId, userId: moi.id });

      // Premier arrivé : les autres membres sont invités (ça sonne chez eux)
      if (autres.length === 0) {
        const g = await groupe(groupId);
        for (const m of g?.members ?? []) {
          if (m.id !== moi.id) {
            envoyerA(m.id, 'group-call:started', {
              groupId, name: g.name, video, from: { id: moi.id, badge_number: moi.badge_number },
            });
          }
        }
      }
      return undefined;
    } catch (err) {
      console.error('Appel de groupe (rejoindre) :', err);
      return repondre(ack, { error: 'Impossible de rejoindre l\'appel' });
    }
  });

  // Qui est dans l'appel d'un groupe (pour afficher « Rejoindre l'appel » en ouvrant le groupe)
  socket.on('group-call:status', async (payload, ack) => {
    const groupId = lireId(payload?.groupId);
    if (!groupId) return repondre(ack, { error: 'Groupe invalide' });
    try {
      if (!(await estMembre(groupId, moi.id))) return repondre(ack, { error: 'Vous n\'êtes pas membre de ce groupe' });
      return repondre(ack, { ok: true, participants: [...(appels.get(groupId)?.keys() ?? [])] });
    } catch {
      return repondre(ack, { error: 'Impossible de lire l\'appel' });
    }
  });

  // Offre, réponse ou candidat ICE, seulement entre deux participants du même appel
  socket.on('group-call:signal', (payload) => {
    const groupId = lireId(payload?.groupId);
    const to = lireId(payload?.to);
    const data = nettoyerSignal(payload?.data);
    const participants = groupId && appels.get(groupId);
    if (!participants || !to || to === moi.id || !data) return;
    if (participants.get(moi.id)?.socketId !== socket.id || !participants.has(to)) return;
    envoyerA(to, 'group-call:signal', { groupId, from: moi.id, data });
  });

  socket.on('group-call:leave', (payload) => {
    const groupId = lireId(payload?.groupId);
    if (groupId) quitter(groupId).catch((err) => console.error('Appel de groupe (quitter) :', err));
  });

  socket.on('disconnect', () => {
    const groupId = socket.data.appelGroupe;
    if (groupId) quitter(groupId).catch((err) => console.error('Appel de groupe (départ) :', err));
  });
}
