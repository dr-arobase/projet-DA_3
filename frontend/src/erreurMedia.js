// Message lisible pour une erreur de getUserMedia, selon sa vraie cause.
// Avant, toute erreur affichait « Micro refusé », même sans micro branché ou micro déjà occupé.
export function messageErreurMedia(err, video = false) {
  const quoi = video ? 'Le micro ou la caméra' : 'Le micro';
  const quoiCourt = video ? 'micro ou caméra' : 'micro';
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return `${quoi} est bloqué : autorisez-le pour ce site dans les réglages du navigateur, puis réessayez. `
        + 'Si c\'est déjà autorisé, le serveur interdit peut-être le micro (en-tête Permissions-Policy).';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return `Aucun ${quoiCourt} utilisable n'a été trouvé sur cet appareil.`;
    case 'NotReadableError':
    case 'AbortError':
      return `${quoi} est déjà utilisé par une autre application (appel, enregistreur…). Fermez-la, puis réessayez.`;
    default:
      return `Impossible d'ouvrir ${video ? 'le micro ou la caméra' : 'le micro'} (${err?.name ?? 'erreur inconnue'}).`;
  }
}
