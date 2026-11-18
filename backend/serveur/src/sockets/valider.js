// Validation de tout ce qu'un navigateur envoie par Socket.IO (FC4).
// Un événement WebSocket ne passe ni par express.json() ni par les contrôleurs : chaque champ
// est vérifié ici (type, longueur, identifiant) avant d'être utilisé ou relayé.
// Une donnée invalide est ignorée (ou refusée dans la réponse ack), jamais transmise telle quelle.

const MAX_INT = 2147483647; // plus grand INTEGER de PostgreSQL (app_user.id, message_group.id)
export const MAX_SDP = 20000; // une description de session fait quelques milliers de caractères
export const MAX_CANDIDAT = 1000;
const MAX_SDP_MID = 64;
const MAX_LIGNE_SDP = 64; // index de ligne m= : quelques médias par appel

// Les données d'un événement : un objet simple, sinon null (une chaîne, un nombre, un tableau ou null)
export const lireObjet = (payload) =>
  (payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null);

// Identifiant d'agent ou de groupe : un entier positif, en nombre ou en chiffres seulement.
// Number() seul acceptait true (1), [2] (2), "0x10" (16), "1e1" (10) ou " 3 " (3).
export function lireId(valeur) {
  const enChiffres = typeof valeur === 'number' || (typeof valeur === 'string' && /^\d{1,10}$/.test(valeur));
  if (!enChiffres) return null;
  const id = Number(valeur);
  return Number.isInteger(id) && id >= 1 && id <= MAX_INT ? id : null;
}

// Identifiant d'appel choisi par l'appelant (crypto.randomUUID côté navigateur)
export const lireCallId = (valeur) => (typeof valeur === 'string' && /^[\w-]{8,64}$/.test(valeur) ? valeur : null);

// Ne garde d'un message de signalisation que ce que WebRTC attend ; null s'il est invalide
export function nettoyerSignal(data) {
  const signal = lireObjet(data);
  if (!signal) return null;
  if (signal.type === 'offer' || signal.type === 'answer') {
    if (typeof signal.sdp !== 'string' || signal.sdp.length === 0 || signal.sdp.length > MAX_SDP) return null;
    return { type: signal.type, sdp: signal.sdp };
  }
  const c = lireObjet(signal.candidate);
  if (c && typeof c.candidate === 'string' && c.candidate.length <= MAX_CANDIDAT) {
    const index = c.sdpMLineIndex;
    return {
      candidate: {
        candidate: c.candidate,
        sdpMid: typeof c.sdpMid === 'string' ? c.sdpMid.slice(0, MAX_SDP_MID) : null,
        sdpMLineIndex: Number.isInteger(index) && index >= 0 && index <= MAX_LIGNE_SDP ? index : null,
      },
    };
  }
  return null;
}
