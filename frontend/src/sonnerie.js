// Sonnerie des appels, produite par le navigateur (Web Audio) : aucun fichier son à charger.
// entrant : deux bips aigus toutes les 2 secondes, et une vibration sur téléphone.
// sortant : tonalité de retour grave et douce pour l'appelant (« ça sonne »).
// Renvoie une fonction qui arrête la sonnerie.
const MOTIFS = {
  entrant: { periode: 2000, notes: [[0, 0.35, 880], [0.5, 0.35, 880]], volume: 0.15, vibration: [350, 150, 350] },
  sortant: { periode: 4000, notes: [[0, 1.2, 425]], volume: 0.05, vibration: null },
};

export function jouerSonnerie(type) {
  const motif = MOTIFS[type];
  const Contexte = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!motif || !Contexte) return () => {};

  let contexte;
  try {
    contexte = new Contexte();
  } catch {
    return () => {};
  }
  // Sans geste de l'utilisateur, certains navigateurs suspendent le son : on tente de le reprendre
  contexte.resume?.().catch(() => {});

  const sonner = () => {
    if (contexte.state === 'closed') return;
    const t0 = contexte.currentTime;
    for (const [decalage, duree, frequence] of motif.notes) {
      const oscillateur = contexte.createOscillator();
      const gain = contexte.createGain();
      oscillateur.frequency.value = frequence;
      gain.gain.setValueAtTime(motif.volume, t0 + decalage);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + decalage + duree);
      oscillateur.connect(gain).connect(contexte.destination);
      oscillateur.start(t0 + decalage);
      oscillateur.stop(t0 + decalage + duree);
    }
    if (motif.vibration) navigator.vibrate?.(motif.vibration);
  };

  sonner();
  const minuterie = window.setInterval(sonner, motif.periode);
  return () => {
    window.clearInterval(minuterie);
    if (motif.vibration) navigator.vibrate?.(0);
    contexte.close().catch(() => {});
  };
}
