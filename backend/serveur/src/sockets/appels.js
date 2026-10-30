// Appels audio et vidéo à deux (#56).
// Le serveur ne fait que relayer la signalisation WebRTC (invitation, réponse, offre, candidats ICE)
// entre deux agents connectés. Le son et l'image passent directement d'un navigateur à l'autre :
// ils ne transitent jamais par le serveur et ne sont pas enregistrés.

const MAX_SDP = 20000; // une description de session fait quelques milliers de caractères
const MAX_CANDIDAT = 1000;
const RAISONS_REFUS = ['refuse', 'occupe', 'sans-reponse'];

const lireId = (valeur) => {
  const id = Number(valeur);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Identifiant d'appel choisi par l'appelant (crypto.randomUUID côté navigateur)
const lireCallId = (valeur) => (typeof valeur === 'string' && /^[\w-]{8,64}$/.test(valeur) ? valeur : null);

// Ne garde d'un message de signalisation que ce que WebRTC attend ; null s'il est invalide
export function nettoyerSignal(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.type === 'offer' || data.type === 'answer') {
    if (typeof data.sdp !== 'string' || data.sdp.length === 0 || data.sdp.length > MAX_SDP) return null;
    return { type: data.type, sdp: data.sdp };
  }
  const c = data.candidate;
  if (c && typeof c === 'object' && typeof c.candidate === 'string' && c.candidate.length <= MAX_CANDIDAT) {
    return {
      candidate: {
        candidate: c.candidate,
        sdpMid: typeof c.sdpMid === 'string' ? c.sdpMid.slice(0, 64) : null,
        sdpMLineIndex: Number.isInteger(c.sdpMLineIndex) ? c.sdpMLineIndex : null,
      },
    };
  }
  return null;
}

// estConnecte(id) : l'agent a au moins un onglet ouvert ; envoyerA(id, événement, données) : à tous ses onglets
export function registerCallHandlers(socket, { estConnecte, envoyerA }) {
  const moi = socket.user;
  const repondre = (ack, resultat) => { if (typeof ack === 'function') ack(resultat); };

  // Destinataire valide : un autre agent, connecté en ce moment
  const destinataire = (payload) => {
    const to = lireId(payload?.to);
    return to && to !== moi.id && estConnecte(to) ? to : null;
  };

  socket.on('call:invite', (payload, ack) => {
    const callId = lireCallId(payload?.callId);
    const to = lireId(payload?.to);
    if (!callId || !to || to === moi.id) return repondre(ack, { error: 'Appel invalide' });
    if (!estConnecte(to)) return repondre(ack, { error: 'Cet agent n\'est pas connecté' });

    envoyerA(to, 'call:incoming', {
      callId,
      video: payload.video === true,
      from: { id: moi.id, badge_number: moi.badge_number },
    });
    return repondre(ack, { ok: true });
  });

  // Réponse de l'appelé, ou fin de l'appel par l'un des deux
  for (const evenement of ['call:accept', 'call:refuse', 'call:end']) {
    socket.on(evenement, (payload) => {
      const callId = lireCallId(payload?.callId);
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
  socket.on('call:signal', (payload) => {
    const callId = lireCallId(payload?.callId);
    const to = destinataire(payload);
    const data = nettoyerSignal(payload?.data);
    if (!callId || !to || !data) return;
    envoyerA(to, 'call:signal', { callId, from: moi.id, data });
  });
}
