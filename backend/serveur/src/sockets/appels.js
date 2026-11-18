// Appels audio et vidéo à deux (#56).
// Le serveur ne fait que relayer la signalisation WebRTC (invitation, réponse, offre, candidats ICE)
// entre deux agents connectés. Le son et l'image passent directement d'un navigateur à l'autre :
// ils ne transitent jamais par le serveur et ne sont pas enregistrés.
//
// Appeler un agent hors ligne : l'invitation attend DUREE_SONNERIE ; s'il se connecte entre-temps,
// ça sonne chez lui. Un appel qui finit sans réponse laisse un message « Appel manqué » (laisserAppelManque).

import { lireObjet, lireId, lireCallId, nettoyerSignal } from './valider.js';

const RAISONS_REFUS = ['refuse', 'occupe', 'sans-reponse'];
export const DUREE_SONNERIE = 30 * 1000; // comme la sonnerie côté navigateur

// Invitations pas encore décrochées, par numéro d'appel : { from, to, video, expire }
// (en mémoire : un redémarrage du serveur coupe de toute façon les appels en cours)
const invitations = new Map();

// Un agent vient de se connecter : les appels qui lui sont destinés et sonnent encore lui parviennent
export function livrerAppelsEnAttente(userId, envoyerA, maintenant = Date.now()) {
  for (const [callId, i] of invitations) {
    if (i.to === userId && i.expire > maintenant) envoyerA(userId, 'call:incoming', { callId, video: i.video, from: i.from });
  }
}

// Pour les tests
export function oublierInvitations() { invitations.clear(); }

// Les vérifications (identifiants, numéro d'appel, signal WebRTC) sont dans valider.js (FC4).
// nettoyerSignal y vit aussi; il reste exporté ici pour les tests existants.
export { nettoyerSignal };

// Une personne qui sonne chez plusieurs agents à la fois : au plus MAX_INVITATIONS appels
// qui sonnent en même temps, pour ne pas laisser une rafale d'« appels manqués » (FC4)
export const MAX_INVITATIONS = 3;

// estConnecte(id) : l'agent a au moins un onglet ouvert ; envoyerA(id, événement, données) : à tous ses onglets
export function registerCallHandlers(socket, { estConnecte, envoyerA, laisserAppelManque = () => {} }) {
  const moi = socket.user;
  const repondre = (ack, resultat) => { if (typeof ack === 'function') ack(resultat); };

  // Destinataire valide : un autre agent, connecté en ce moment
  const destinataire = (payload) => {
    const to = lireId(payload?.to);
    return to && to !== moi.id && estConnecte(to) ? to : null;
  };

  // Fin d'un appel jamais décroché : on l'oublie et, s'il le faut, on laisse un « Appel manqué »
  const clore = (callId, manque) => {
    const i = invitations.get(callId);
    if (!i) return;
    invitations.delete(callId);
    if (manque) {
      Promise.resolve()
        .then(() => laisserAppelManque({ fromId: i.from.id, toId: i.to, video: i.video }))
        .catch((err) => console.error('Appel manqué non enregistré :', err));
    }
  };

  socket.on('call:invite', (donnees, ack) => {
    const payload = lireObjet(donnees);
    const callId = lireCallId(payload?.callId);
    const to = lireId(payload?.to);
    if (!callId || !to || to === moi.id) return repondre(ack, { error: 'Appel invalide' });

    // Une invitation à la fois vers le même agent : pas de rafale d'« appels manqués »
    const maintenant = Date.now();
    const miennes = [...invitations.values()].filter((i) => i.from.id === moi.id && i.expire > maintenant);
    if (miennes.some((i) => i.to === to) || invitations.has(callId)) {
      return repondre(ack, { error: 'Un appel vers cet agent est déjà en cours' });
    }
    if (miennes.length >= MAX_INVITATIONS) {
      return repondre(ack, { error: `Au plus ${MAX_INVITATIONS} appels peuvent sonner en même temps` });
    }

    const video = payload.video === true;
    const from = { id: moi.id, badge_number: moi.badge_number };
    invitations.set(callId, { from, to, video, expire: Date.now() + DUREE_SONNERIE });
    // Filet de sécurité : sans nouvelles de l'appelant (onglet fermé), l'invitation finit en appel manqué
    setTimeout(() => clore(callId, true), DUREE_SONNERIE + 5000).unref?.();

    // Hors ligne : ça sonnera s'il se connecte avant la fin de la sonnerie
    if (!estConnecte(to)) return repondre(ack, { ok: true, horsLigne: true });
    envoyerA(to, 'call:incoming', { callId, video, from });
    return repondre(ack, { ok: true });
  });

  // Réponse de l'appelé, ou fin de l'appel par l'un des deux
  for (const evenement of ['call:accept', 'call:refuse', 'call:end']) {
    socket.on(evenement, (recu) => {
      const payload = lireObjet(recu);
      const callId = lireCallId(payload?.callId);
      // Seuls les deux agents de l'appel peuvent le clore. Décroché : plus un appel manqué.
      // Refusé exprès : rien à laisser. Fin ou « sans réponse » avant de décrocher : appel manqué.
      const invitation = callId && invitations.get(callId);
      if (invitation && [invitation.from.id, invitation.to].includes(moi.id)) {
        if (evenement === 'call:accept') invitations.delete(callId);
        else clore(callId, !(evenement === 'call:refuse' && payload?.reason === 'refuse'));
      }
      const to = destinataire(payload);
      if (!callId || !to) return;
      const donnees = { callId, from: moi.id };
      if (evenement === 'call:refuse') {
        donnees.reason = RAISONS_REFUS.includes(payload.reason) ? payload.reason : 'refuse';
      }
      envoyerA(to, evenement, donnees);
      // L'appel a été pris ou refusé dans un onglet : les autres onglets de l'appelé arrêtent de sonner
      if (evenement !== 'call:end') socket.to(`agent:${moi.id}`).emit('call:handled', { callId });
    });
  }

  // Offre, réponse et candidats ICE, validés puis relayés tels quels à l'autre agent
  socket.on('call:signal', (donnees) => {
    const payload = lireObjet(donnees);
    const callId = lireCallId(payload?.callId);
    const to = destinataire(payload);
    const data = nettoyerSignal(payload?.data);
    if (!callId || !to || !data) return;
    envoyerA(to, 'call:signal', { callId, from: moi.id, data });
  });
}
