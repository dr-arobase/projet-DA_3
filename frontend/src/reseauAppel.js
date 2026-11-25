// Réseau des appels (WebRTC) : tout essayer, sur n'importe quel réseau (Wi-Fi lent ou rapide, 3G, 4G, 5G).
// - Tous les chemins sont essayés : direct, STUN (deux fournisseurs), puis le relais TURN en UDP, TCP
//   et TLS sur le port 443 quand le serveur en donne un (GET /api/turn).
// - Sur un réseau lent, la vidéo démarre plus légère et le son passe en priorité; WebRTC baisse
//   ensuite la qualité tout seul si le débit chute, sans couper l'appel.
// - Un chemin qui tombe (Wi-Fi vers 4G, tunnel) est renégocié (ICE restart) avant d'abandonner,
//   et l'abandon donne un message qui dit pourquoi.

// Sans réponse de GET /api/turn : deux serveurs STUN publics (si l'un ne répond pas, l'autre suffit).
export const SERVEURS_ICE_SECOURS = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];

// Candidats préparés d'avance : la connexion se trouve plus vite, surtout sur un réseau lent.
export const TAILLE_RESERVE_ICE = 4;

// Une coupure brève (passage du Wi-Fi à la 4G, tunnel) se rattrape souvent toute seule.
export const DELAI_COUPURE = 5 * 1000;
// Deux nouveaux essais du chemin réseau avant d'abandonner.
export const ESSAIS_REDEMARRAGE = 2;

const urlsDe = (serveur) => [serveur?.urls].flat().filter(Boolean);

// Vrai si un relais TURN est disponible : sans lui, deux réseaux qui bloquent la connexion directe
// (données mobiles, Wi-Fi d'école ou d'entreprise) ne peuvent pas se joindre.
export function aUnRelais(serveurs) {
  return (serveurs ?? []).some((s) => urlsDe(s).some((u) => /^turns?:/i.test(u)));
}

export function messageEchec(serveurs) {
  return aUnRelais(serveurs)
    ? 'Impossible de joindre l\'autre appareil, même par le relais. Vérifiez la connexion Internet des deux appareils, puis rappelez.'
    : 'Impossible de joindre l\'autre appareil : vos deux réseaux bloquent la connexion directe (données mobiles, Wi-Fi d\'école ou d\'entreprise), et le relais des appels n\'est pas encore en place sur le serveur. Essayez sur le même Wi-Fi.';
}

// « lent » : 2G ou 3G, économie de données activée, ou moins de 1,5 Mb/s annoncés par le navigateur.
// Sans information (Safari, Firefox), on suppose un réseau normal : WebRTC s'adapte ensuite.
export function profilReseau(connexion = globalThis.navigator?.connection) {
  if (!connexion) return 'normal';
  if (connexion.saveData) return 'lent';
  if (['slow-2g', '2g', '3g'].includes(connexion.effectiveType)) return 'lent';
  if (typeof connexion.downlink === 'number' && connexion.downlink > 0 && connexion.downlink < 1.5) return 'lent';
  return 'normal';
}

// Temps laissé pour relier les deux appareils avant un nouvel essai : plus long sur un réseau lent.
export const delaiConnexion = (profil) => (profil === 'lent' ? 35 * 1000 : 20 * 1000);

// Caméra : avant ou arrière; plus petite et moins d'images par seconde sur un réseau lent.
export function contraintesVideo(face = 'user', profil = 'normal') {
  return profil === 'lent'
    ? { facingMode: face, width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 15 } }
    : { facingMode: face, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } };
}

// Débits de départ : le son reste audible même quand l'image ne passe plus.
export const DEBITS = {
  lent: { audio: 24_000, video: 250_000, images: 15 },
  normal: { audio: 40_000, video: 900_000, images: 30 },
};

// Applique les débits et la priorité du son à chaque piste envoyée. Ce que le navigateur ne connaît
// pas est ignoré : l'appel marche quand même.
export async function reglerDebits(conn, profil = 'normal') {
  const d = DEBITS[profil] ?? DEBITS.normal;
  await Promise.all((conn?.getSenders?.() ?? []).map(async (envoi) => {
    const sorte = envoi.track?.kind;
    if (!sorte || typeof envoi.getParameters !== 'function') return;
    try {
      const p = envoi.getParameters();
      if (!p.encodings?.length) p.encodings = [{}];
      for (const e of p.encodings) {
        if (sorte === 'audio') {
          e.maxBitrate = d.audio;
          e.priority = 'high';
          e.networkPriority = 'high';
        } else {
          e.maxBitrate = d.video;
          e.maxFramerate = d.images;
        }
      }
      // L'image baisse de qualité avant de saccader
      if (sorte === 'video') p.degradationPreference = 'balanced';
      await envoi.setParameters(p);
    } catch { /* navigateur qui refuse un réglage : on garde ses valeurs */ }
  }));
}
