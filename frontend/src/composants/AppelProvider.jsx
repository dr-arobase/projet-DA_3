import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../api.js';
import { nomAgent } from '../agents.js';
import { AppelContext } from './AppelContext.js';
import { useEvenement, useTempsReel } from './TempsReelContext.js';
import Avatar from './Avatar.jsx';

// Appels audio et vidéo à deux (#56), en WebRTC : le son et l'image vont directement d'un navigateur
// à l'autre. Le serveur ne relaie que la signalisation (Socket.IO : call:invite, call:accept,
// call:refuse, call:end, call:signal), et seulement entre deux agents connectés.
// Un serveur STUN public trouve l'adresse de chaque navigateur ; sans serveur TURN, un réseau très
// fermé (pare-feu d'entreprise) peut empêcher l'appel : le message « connexion perdue » s'affiche alors.
const SERVEURS_ICE = [{ urls: 'stun:stun.l.google.com:19302' }];
const DELAI_SONNERIE = 30 * 1000;
const DUREE_AVIS = 6000;

const dureeLisible = (ms) => {
  // Jamais négatif : l'horloge de l'écran peut retarder d'une seconde au tout début de l'appel
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const nomDe = (agent) => (agent?.first_name ? nomAgent(agent) : agent?.badge_number ?? 'L\'agent');

// Micro : suppression d'écho et de bruit (haut-parleur du téléphone, rue, voiture).
// Caméra : avant par défaut, en qualité modérée pour passer sur un réseau mobile.
const CONTRAINTES_AUDIO = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
const contraintesVideo = (face = 'user') => ({ facingMode: face, width: { ideal: 640 }, height: { ideal: 480 } });

// Flux audio ou vidéo branché sur un élément <audio> ou <video>.
// Sur téléphone (Safari surtout), la lecture automatique peut être refusée : onBloque le signale.
function Media({ flux, video, muet = false, className, onBloque }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = flux ?? null;
    if (flux) el.play().catch(() => onBloque?.());
  }, [flux, onBloque]);
  return video
    ? <video ref={ref} className={className} autoPlay playsInline muted={muet} />
    : <audio ref={ref} autoPlay playsInline muted={muet} />;
}

export default function AppelProvider({ children }) {
  const { socket } = useTempsReel();
  const [appel, setAppel] = useState(null); // { phase, callId, agent, video, debut }
  const [avis, setAvis] = useState('');
  const [micro, setMicro] = useState(true);
  const [camera, setCamera] = useState(true);
  const [fluxLocal, setFluxLocal] = useState(null);
  const [fluxDistant, setFluxDistant] = useState(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [sonBloque, setSonBloque] = useState(false);
  const [face, setFace] = useState('user'); // caméra avant ('user') ou arrière ('environment')
  const [plusieursCameras, setPlusieursCameras] = useState(false);

  // Copies pour les gestionnaires d'événements (toujours l'appel en cours, sans attendre un rendu)
  const appelRef = useRef(null);
  const connexion = useRef(null);
  const local = useRef(null);
  const candidatsEnAttente = useRef([]);
  const sonnerie = useRef(null);

  const changerAppel = useCallback((suivant) => {
    appelRef.current = suivant;
    setAppel(suivant);
  }, []);

  // Fin de l'appel, quelle qu'en soit la raison : micro et caméra coupés, connexion fermée
  const terminer = useCallback((message = '') => {
    window.clearTimeout(sonnerie.current);
    connexion.current?.close();
    connexion.current = null;
    local.current?.getTracks().forEach((piste) => piste.stop());
    local.current = null;
    candidatsEnAttente.current = [];
    setFluxLocal(null);
    setFluxDistant(null);
    setMicro(true);
    setCamera(true);
    setSonBloque(false);
    setFace('user');
    changerAppel(null);
    setAvis(message);
  }, [changerAppel]);

  // Envoie un événement d'appel à l'autre agent de l'appel en cours
  const signaler = useCallback((evenement, donnees = {}) => {
    const a = appelRef.current;
    if (a && socket) socket.emit(evenement, { to: a.agent.id, callId: a.callId, ...donnees });
  }, [socket]);

  const raccrocher = useCallback((message = 'Appel terminé.') => {
    signaler('call:end');
    terminer(message);
  }, [signaler, terminer]);

  async function ouvrirMicroEtCamera(video) {
    // Hors https (ex. téléphone sur http://192.168.x.x:5173), le navigateur cache micro et caméra
    if (!window.isSecureContext) {
      throw new Error('Les appels exigent une adresse sécurisée (https). Ouvrez CrimeTracker par son adresse https, puis réessayez.');
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
      throw new Error('Ce navigateur ne permet pas les appels.');
    }
    try {
      local.current = await navigator.mediaDevices.getUserMedia({
        audio: CONTRAINTES_AUDIO,
        video: video ? contraintesVideo('user') : false,
      });
    } catch {
      throw new Error(video
        ? 'Micro ou caméra refusé : autorisez-les pour ce site dans le navigateur, puis réessayez.'
        : 'Micro refusé : autorisez le micro pour ce site dans le navigateur, puis réessayez.');
    }
    setFluxLocal(local.current);
    if (video) {
      // Téléphone : caméra avant et arrière, on propose de basculer
      const appareils = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      setPlusieursCameras(appareils.filter((a) => a.kind === 'videoinput').length > 1);
    }
  }

  const creerConnexion = useCallback(() => {
    const conn = new RTCPeerConnection({ iceServers: SERVEURS_ICE });
    local.current.getTracks().forEach((piste) => conn.addTrack(piste, local.current));
    conn.onicecandidate = (e) => {
      if (e.candidate) signaler('call:signal', { data: { candidate: e.candidate.toJSON() } });
    };
    conn.ontrack = (e) => setFluxDistant(e.streams[0]);
    conn.onconnectionstatechange = () => {
      if (conn.connectionState === 'connected' && appelRef.current?.phase !== 'en-cours') {
        changerAppel({ ...appelRef.current, phase: 'en-cours', debut: Date.now() });
      }
      if (conn.connectionState === 'failed') raccrocher('La connexion avec l\'autre agent a été perdue.');
    };
    connexion.current = conn;
    return conn;
  }, [signaler, changerAppel, raccrocher]);

  // Les candidats ICE arrivés avant la description de l'autre navigateur sont ajoutés après
  async function viderCandidats() {
    for (const candidat of candidatsEnAttente.current) {
      await connexion.current?.addIceCandidate(candidat);
    }
    candidatsEnAttente.current = [];
  }

  // Appeler un agent depuis la messagerie
  const appeler = useCallback(async (agent, video) => {
    if (appelRef.current) return setAvis('Un appel est déjà en cours.');
    if (!socket?.connected) return setAvis('Connexion temps réel interrompue : impossible d\'appeler pour l\'instant.');
    try {
      await ouvrirMicroEtCamera(video);
    } catch (err) {
      return setAvis(err.message);
    }
    const callId = crypto.randomUUID();
    changerAppel({ phase: 'sortant', callId, agent, video });
    setAvis('');
    socket.emit('call:invite', { to: agent.id, callId, video }, (reponse) => {
      if (appelRef.current?.callId !== callId) return;
      if (reponse?.error) terminer(reponse.error);
      // Hors ligne : le serveur garde l'appel ; ça sonne chez lui s'il se connecte pendant la sonnerie
      else if (reponse?.horsLigne) changerAppel({ ...appelRef.current, horsLigne: true });
    });
    sonnerie.current = window.setTimeout(() => {
      if (appelRef.current?.callId === callId && appelRef.current.phase === 'sortant') {
        raccrocher(`${nomDe(agent)} n'a pas répondu. Un appel manqué lui a été laissé dans la messagerie.`);
      }
    }, DELAI_SONNERIE);
    return undefined;
  }, [socket, changerAppel, terminer, raccrocher]);

  async function accepter() {
    const a = appelRef.current;
    if (!a || a.phase !== 'entrant') return;
    window.clearTimeout(sonnerie.current);
    try {
      await ouvrirMicroEtCamera(a.video);
    } catch (err) {
      signaler('call:refuse', { reason: 'refuse' });
      terminer(err.message);
      return;
    }
    creerConnexion();
    changerAppel({ ...a, phase: 'connexion' });
    signaler('call:accept');
  }

  function refuser() {
    signaler('call:refuse', { reason: 'refuse' });
    terminer('');
  }

  // Appel reçu : il sonne sur n'importe quelle page ; déjà en appel, on répond « occupé »
  useEvenement('call:incoming', useCallback(({ callId, video, from }) => {
    if (appelRef.current) {
      socket?.emit('call:refuse', { to: from.id, callId, reason: 'occupe' });
      return;
    }
    changerAppel({ phase: 'entrant', callId, agent: { id: from.id, badge_number: from.badge_number }, video });
    setAvis('');
    // Le nom et la photo de l'appelant, pour l'écran d'appel
    api.listerContacts().then((contacts) => {
      const agent = contacts.find((c) => c.id === from.id);
      if (agent && appelRef.current?.callId === callId) changerAppel({ ...appelRef.current, agent });
    }).catch(() => {});
    sonnerie.current = window.setTimeout(() => {
      if (appelRef.current?.callId === callId && appelRef.current.phase === 'entrant') {
        signaler('call:refuse', { reason: 'sans-reponse' });
        terminer(`Appel manqué de ${nomDe(appelRef.current.agent)}.`);
      }
    }, DELAI_SONNERIE);
  }, [socket, changerAppel, signaler, terminer]));

  // L'appelé a décroché : l'appelant envoie son offre
  useEvenement('call:accept', useCallback(async ({ callId }) => {
    const a = appelRef.current;
    if (!a || a.callId !== callId || a.phase !== 'sortant') return;
    window.clearTimeout(sonnerie.current);
    changerAppel({ ...a, phase: 'connexion' });
    try {
      const conn = creerConnexion();
      const offre = await conn.createOffer();
      await conn.setLocalDescription(offre);
      signaler('call:signal', { data: { type: offre.type, sdp: offre.sdp } });
    } catch {
      raccrocher('Impossible d\'établir l\'appel.');
    }
  }, [changerAppel, creerConnexion, signaler, raccrocher]));

  // Offre, réponse et candidats ICE de l'autre navigateur
  useEvenement('call:signal', useCallback(async ({ callId, data }) => {
    const conn = connexion.current;
    if (!conn || appelRef.current?.callId !== callId) return;
    try {
      if (data.type === 'offer') {
        await conn.setRemoteDescription(data);
        await viderCandidats();
        const reponse = await conn.createAnswer();
        await conn.setLocalDescription(reponse);
        signaler('call:signal', { data: { type: reponse.type, sdp: reponse.sdp } });
      } else if (data.type === 'answer') {
        await conn.setRemoteDescription(data);
        await viderCandidats();
      } else if (data.candidate) {
        if (conn.remoteDescription) await conn.addIceCandidate(data.candidate);
        else candidatsEnAttente.current.push(data.candidate);
      }
    } catch {
      raccrocher('Impossible d\'établir l\'appel.');
    }
  }, [signaler, raccrocher]));

  useEvenement('call:refuse', useCallback(({ callId, reason }) => {
    const a = appelRef.current;
    if (!a || a.callId !== callId) return;
    const nom = nomDe(a.agent);
    terminer({
      occupe: `${nom} est déjà en appel.`,
      'sans-reponse': `${nom} n'a pas répondu.`,
    }[reason] ?? `${nom} a refusé l'appel.`);
  }, [terminer]));

  useEvenement('call:end', useCallback(({ callId }) => {
    const a = appelRef.current;
    if (!a || a.callId !== callId) return;
    terminer(a.phase === 'entrant' ? `Appel manqué de ${nomDe(a.agent)}.` : `${nomDe(a.agent)} a raccroché.`);
  }, [terminer]));

  // Décroché ou refusé dans un autre onglet : celui-ci arrête de sonner
  useEvenement('call:handled', useCallback(({ callId }) => {
    if (appelRef.current?.callId === callId && appelRef.current.phase === 'entrant') terminer('');
  }, [terminer]));

  // Quitter l'application (déconnexion) raccroche : seulement au démontage, pas à chaque rendu
  const raccrocherAuDepart = useRef(raccrocher);
  useEffect(() => { raccrocherAuDepart.current = raccrocher; }, [raccrocher]);
  useEffect(() => () => {
    if (appelRef.current) raccrocherAuDepart.current('');
  }, []);

  // Fermer l'onglet pendant un appel prévient l'autre agent
  useEffect(() => {
    const auRevoir = () => { if (appelRef.current) signaler('call:end'); };
    window.addEventListener('pagehide', auRevoir);
    return () => window.removeEventListener('pagehide', auRevoir);
  }, [signaler]);

  // Durée de l'appel
  const enCours = appel?.phase === 'en-cours';
  useEffect(() => {
    if (!enCours) return undefined;
    const minuterie = window.setInterval(() => setMaintenant(Date.now()), 1000);
    return () => window.clearInterval(minuterie);
  }, [enCours]);

  // Les messages de fin d'appel disparaissent seuls
  useEffect(() => {
    if (!avis) return undefined;
    const minuterie = window.setTimeout(() => setAvis(''), DUREE_AVIS);
    return () => window.clearTimeout(minuterie);
  }, [avis]);

  function basculerMicro() {
    local.current?.getAudioTracks().forEach((piste) => { piste.enabled = !micro; });
    setMicro(!micro);
  }

  // Caméra avant ↔ arrière : on remplace la piste vidéo envoyée, sans couper l'appel
  async function changerDeCamera() {
    const suivante = face === 'user' ? 'environment' : 'user';
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ video: contraintesVideo(suivante) });
      const nouvelle = flux.getVideoTracks()[0];
      nouvelle.enabled = camera;
      const envoi = connexion.current?.getSenders().find((x) => x.track?.kind === 'video');
      await envoi?.replaceTrack(nouvelle);
      local.current.getVideoTracks().forEach((piste) => { piste.stop(); local.current.removeTrack(piste); });
      local.current.addTrack(nouvelle);
      setFluxLocal(new MediaStream(local.current.getTracks()));
      setFace(suivante);
    } catch {
      setAvis('Impossible de changer de caméra sur cet appareil.');
    }
  }

  const sonRefuse = useCallback(() => setSonBloque(true), []);
  function activerSon() {
    document.querySelectorAll('.appel video, .appel audio').forEach((el) => el.play().catch(() => {}));
    setSonBloque(false);
  }

  function basculerCamera() {
    local.current?.getVideoTracks().forEach((piste) => { piste.enabled = !camera; });
    setCamera(!camera);
  }

  const etat = appel && {
    entrant: `Appel ${appel.video ? 'vidéo' : 'audio'} entrant…`,
    sortant: appel.horsLigne ? 'Hors ligne · ça sonnera s\'il se connecte…' : 'Ça sonne…',
    connexion: 'Connexion…',
    'en-cours': dureeLisible(maintenant - (appel.debut ?? maintenant)),
  }[appel.phase];

  return (
    <AppelContext.Provider value={{ appeler, enAppel: Boolean(appel) }}>
      {children}

      {appel && (
        <section className={`appel${appel.video ? ' video' : ''} ${appel.phase}`} role="dialog" aria-label={`Appel avec ${nomDe(appel.agent)}`}>
          <header className="appel-entete">
            <Avatar utilisateur={appel.agent} className="avatar appel-avatar" />
            <div>
              <strong>{nomDe(appel.agent)}</strong>
              <small aria-live="polite">{etat}</small>
            </div>
          </header>

          {appel.video ? (
            <div className="appel-videos">
              <Media flux={fluxDistant} video className="appel-distant" onBloque={sonRefuse} />
              <Media flux={fluxLocal} video muet className={`appel-local${face === 'user' ? ' miroir' : ''}`} />
            </div>
          ) : (
            <Media flux={fluxDistant} onBloque={sonRefuse} />
          )}

          {sonBloque && (
            <button type="button" className="appel-son" onClick={activerSon}>Toucher pour activer le son</button>
          )}

          <div className="appel-boutons">
            {appel.phase === 'entrant' ? (
              <>
                <button type="button" className="appel-accepter" onClick={accepter}>Accepter</button>
                <button type="button" className="appel-raccrocher" onClick={refuser}>Refuser</button>
              </>
            ) : (
              <>
                <button type="button" aria-pressed={!micro} onClick={basculerMicro}>
                  {micro ? 'Couper le micro' : 'Réactiver le micro'}
                </button>
                {appel.video && (
                  <button type="button" aria-pressed={!camera} onClick={basculerCamera}>
                    {camera ? 'Couper la caméra' : 'Réactiver la caméra'}
                  </button>
                )}
                {appel.video && plusieursCameras && (
                  <button type="button" onClick={changerDeCamera}>
                    {face === 'user' ? 'Caméra arrière' : 'Caméra avant'}
                  </button>
                )}
                <button type="button" className="appel-raccrocher" onClick={() => raccrocher()}>Raccrocher</button>
              </>
            )}
          </div>
        </section>
      )}

      {avis && <p className="appel-avis" role="status">{avis}</p>}
    </AppelContext.Provider>
  );
}
