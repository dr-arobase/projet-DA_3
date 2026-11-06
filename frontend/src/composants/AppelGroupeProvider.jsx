import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../api.js';
import { nomAgent } from '../agents.js';
import { AppelGroupeContext } from './AppelGroupeContext.js';
import { useAppel } from './AppelContext.js';
import { useAuth } from './AuthContext.js';
import { useEvenement, useTempsReel } from './TempsReelContext.js';
import Avatar from './Avatar.jsx';
import { messageErreurMedia } from '../erreurMedia.js';
import { jouerSonnerie } from '../sonnerie.js';

// Appels audio et vidéo de groupe (6 participants au plus). Chaque participant est relié directement
// à chacun des autres (WebRTC) : le serveur ne relaie que la signalisation (group-call:*) et vérifie
// que chacun est membre du groupe. Le nouvel arrivant envoie une offre à ceux déjà présents.
const SERVEURS_ICE = [{ urls: 'stun:stun.l.google.com:19302' }];
const DUREE_INVITATION = 30 * 1000;
const DUREE_AVIS = 6000;
const CONTRAINTES_AUDIO = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
const CONTRAINTES_VIDEO = { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 360 } };

// Flux d'un participant branché sur <video> ou <audio>
function Media({ flux, video, muet = false, className }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = flux ?? null;
    if (flux) el.play().catch(() => {});
  }, [flux]);
  return video
    ? <video ref={ref} className={className} autoPlay playsInline muted={muet} />
    : <audio ref={ref} autoPlay playsInline muted={muet} />;
}

export default function AppelGroupeProvider({ children }) {
  const { socket } = useTempsReel();
  const { utilisateur } = useAuth();
  const { enAppel } = useAppel();
  const [appel, setAppel] = useState(null); // { groupId, nom, video }
  const [participants, setParticipants] = useState([]); // ids des autres agents dans l'appel
  const [flux, setFlux] = useState({}); // id -> MediaStream reçu
  const [fluxLocal, setFluxLocal] = useState(null);
  const [agents, setAgents] = useState({}); // id -> agent (nom, photo)
  const [invitation, setInvitation] = useState(null); // { groupId, name, video, from }
  const [appelsEnCours, setAppelsEnCours] = useState(() => new Set());
  const [micro, setMicro] = useState(true);
  const [camera, setCamera] = useState(true);
  const [avis, setAvis] = useState('');

  const appelRef = useRef(null);
  const local = useRef(null);
  const serveursIce = useRef(SERVEURS_ICE);
  const connexions = useRef(new Map()); // id -> RTCPeerConnection
  const candidatsEnAttente = useRef(new Map()); // id -> [candidat] reçus avant la description distante

  const marquerAppel = useCallback((groupId, actif) => {
    setAppelsEnCours((enCours) => {
      if (enCours.has(groupId) === actif) return enCours;
      const suivant = new Set(enCours);
      if (actif) suivant.add(groupId); else suivant.delete(groupId);
      return suivant;
    });
  }, []);

  const fermerPair = useCallback((id) => {
    connexions.current.get(id)?.close();
    connexions.current.delete(id);
    candidatsEnAttente.current.delete(id);
    setFlux((f) => Object.fromEntries(Object.entries(f).filter(([cle]) => Number(cle) !== id)));
    setParticipants((ids) => ids.filter((x) => x !== id));
  }, []);

  // Fin de l'appel pour cet agent : connexions fermées, micro et caméra coupés
  const nettoyer = useCallback((message = '') => {
    for (const id of [...connexions.current.keys()]) connexions.current.get(id)?.close();
    connexions.current.clear();
    candidatsEnAttente.current.clear();
    local.current?.getTracks().forEach((piste) => piste.stop());
    local.current = null;
    appelRef.current = null;
    setAppel(null);
    setParticipants([]);
    setFlux({});
    setFluxLocal(null);
    setMicro(true);
    setCamera(true);
    setAvis(message);
  }, []);

  const envoyerSignal = useCallback((to, data) => {
    const a = appelRef.current;
    if (a && socket) socket.emit('group-call:signal', { groupId: a.groupId, to, data });
  }, [socket]);

  // Connexion directe avec un participant; initiateur : c'est nous qui envoyons l'offre
  const creerPair = useCallback((id, initiateur) => {
    const conn = new RTCPeerConnection({ iceServers: serveursIce.current });
    connexions.current.set(id, conn);
    local.current?.getTracks().forEach((piste) => conn.addTrack(piste, local.current));
    conn.onicecandidate = (e) => { if (e.candidate) envoyerSignal(id, { candidate: e.candidate.toJSON() }); };
    conn.ontrack = (e) => setFlux((f) => ({ ...f, [id]: e.streams[0] }));
    conn.onconnectionstatechange = () => {
      if (conn.connectionState === 'failed') fermerPair(id);
    };
    setParticipants((ids) => (ids.includes(id) ? ids : [...ids, id]));
    if (initiateur) {
      conn.createOffer()
        .then((offre) => conn.setLocalDescription(offre).then(() => envoyerSignal(id, { type: offre.type, sdp: offre.sdp })))
        .catch(() => fermerPair(id));
    }
    return conn;
  }, [envoyerSignal, fermerPair]);

  const quitter = useCallback(() => {
    const a = appelRef.current;
    if (a && socket) socket.emit('group-call:leave', { groupId: a.groupId });
    nettoyer('Vous avez quitté l\'appel de groupe.');
  }, [socket, nettoyer]);

  // Rejoindre (ou lancer) l'appel d'un groupe : { id, name }
  const rejoindre = useCallback(async (groupe, video = false) => {
    if (appelRef.current) return setAvis('Vous êtes déjà dans un appel de groupe.');
    if (enAppel) return setAvis('Terminez d\'abord votre appel en cours.');
    if (!socket?.connected) return setAvis('Connexion temps réel interrompue : impossible d\'appeler pour l\'instant.');
    if (!window.isSecureContext) return setAvis('Les appels exigent une adresse sécurisée (https).');
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
      return setAvis('Ce navigateur ne permet pas les appels.');
    }
    setInvitation(null);
    const ice = api.serveursIce().then((r) => r?.iceServers ?? SERVEURS_ICE).catch(() => SERVEURS_ICE);
    try {
      local.current = await navigator.mediaDevices.getUserMedia({ audio: CONTRAINTES_AUDIO, video: video ? CONTRAINTES_VIDEO : false });
    } catch (err) {
      return setAvis(messageErreurMedia(err, video));
    }
    serveursIce.current = await ice;
    setFluxLocal(local.current);
    api.listerContacts()
      .then((liste) => setAgents(Object.fromEntries(liste.map((a) => [a.id, a]))))
      .catch(() => {});

    appelRef.current = { groupId: groupe.id, nom: groupe.name, video };
    setAppel(appelRef.current);
    socket.emit('group-call:join', { groupId: groupe.id, video }, (reponse) => {
      if (!appelRef.current || appelRef.current.groupId !== groupe.id) return;
      if (reponse?.error) {
        nettoyer(reponse.error);
        return;
      }
      marquerAppel(groupe.id, true);
      for (const id of reponse.participants ?? []) creerPair(id, true);
    });
    return undefined;
  }, [enAppel, socket, nettoyer, marquerAppel, creerPair]);

  // Ouvrir un groupe : savoir si un appel y a lieu, pour proposer de le rejoindre
  const verifierAppel = useCallback((groupId) => {
    if (!socket?.connected || !groupId) return;
    socket.emit('group-call:status', { groupId }, (reponse) => {
      if (reponse?.ok) marquerAppel(groupId, reponse.participants.length > 0);
    });
  }, [socket, marquerAppel]);

  useEvenement('group-call:signal', useCallback(async ({ groupId, from, data }) => {
    const a = appelRef.current;
    if (!a || a.groupId !== groupId) return;
    const conn = connexions.current.get(from) ?? creerPair(from, false);
    try {
      if (data.type === 'offer' || data.type === 'answer') {
        await conn.setRemoteDescription({ type: data.type, sdp: data.sdp });
        for (const c of candidatsEnAttente.current.get(from) ?? []) await conn.addIceCandidate(c).catch(() => {});
        candidatsEnAttente.current.delete(from);
        if (data.type === 'offer') {
          const reponse = await conn.createAnswer();
          await conn.setLocalDescription(reponse);
          envoyerSignal(from, { type: reponse.type, sdp: reponse.sdp });
        }
      } else if (data.candidate) {
        if (conn.remoteDescription) await conn.addIceCandidate(data.candidate).catch(() => {});
        else candidatsEnAttente.current.set(from, [...(candidatsEnAttente.current.get(from) ?? []), data.candidate]);
      }
    } catch {
      fermerPair(from);
    }
  }, [creerPair, envoyerSignal, fermerPair]));

  // Un nouvel arrivant : il nous enverra son offre
  useEvenement('group-call:joined', useCallback(({ groupId, userId }) => {
    if (appelRef.current?.groupId === groupId) setParticipants((ids) => (ids.includes(userId) ? ids : [...ids, userId]));
  }, []));

  useEvenement('group-call:left', useCallback(({ groupId, userId }) => {
    if (appelRef.current?.groupId === groupId) fermerPair(userId);
  }, [fermerPair]));

  // Un membre lance un appel dans un de nos groupes : invitation qui sonne
  useEvenement('group-call:started', useCallback((donnees) => {
    marquerAppel(donnees.groupId, true);
    if (appelRef.current || donnees.from?.id === utilisateur?.id) return;
    setInvitation(donnees);
  }, [marquerAppel, utilisateur?.id]));

  useEvenement('group-call:ended', useCallback(({ groupId }) => {
    marquerAppel(groupId, false);
    setInvitation((i) => (i?.groupId === groupId ? null : i));
  }, [marquerAppel]));

  // L'invitation sonne 30 secondes, puis disparaît seule
  const groupeInvite = invitation?.groupId;
  useEffect(() => {
    if (!groupeInvite) return undefined;
    const arreter = jouerSonnerie('entrant');
    const minuterie = window.setTimeout(() => setInvitation(null), DUREE_INVITATION);
    return () => { arreter(); window.clearTimeout(minuterie); };
  }, [groupeInvite]);

  useEffect(() => {
    if (!avis) return undefined;
    const minuterie = window.setTimeout(() => setAvis(''), DUREE_AVIS);
    return () => window.clearTimeout(minuterie);
  }, [avis]);

  // Quitter l'application (déconnexion) quitte l'appel : seulement au démontage
  const quitterAuDepart = useRef(quitter);
  useEffect(() => { quitterAuDepart.current = quitter; }, [quitter]);
  useEffect(() => () => { if (appelRef.current) quitterAuDepart.current(); }, []);

  function basculerMicro() {
    local.current?.getAudioTracks().forEach((piste) => { piste.enabled = !micro; });
    setMicro(!micro);
  }

  function basculerCamera() {
    local.current?.getVideoTracks().forEach((piste) => { piste.enabled = !camera; });
    setCamera(!camera);
  }

  const nom = (id) => (agents[id] ? nomAgent(agents[id]) : `Agent n° ${id}`);

  return (
    <AppelGroupeContext.Provider value={{
      rejoindre, verifierAppel, appelGroupeId: appel?.groupId ?? null, appelsEnCours,
    }}>
      {children}

      {appel && (
        <section className={`appel appel-groupe${appel.video ? ' video' : ''}`} role="dialog" aria-label={`Appel de groupe : ${appel.nom}`}>
          <header className="appel-entete">
            <div>
              <strong>{appel.nom}</strong>
              <small aria-live="polite">
                {participants.length === 0
                  ? 'En attente des autres membres…'
                  : `${participants.length + 1} participants`}
              </small>
            </div>
          </header>

          <ul className="appel-grille">
            <li className="appel-tuile">
              {appel.video && camera
                ? <Media flux={fluxLocal} video muet className="appel-tuile-video miroir" />
                : <Avatar utilisateur={utilisateur} className="avatar appel-avatar" />}
              <span>Vous{!micro && ' · micro coupé'}</span>
            </li>
            {participants.map((id) => (
              <li className="appel-tuile" key={id}>
                {appel.video
                  ? <Media flux={flux[id]} video className="appel-tuile-video" />
                  : (
                    <>
                      <Avatar utilisateur={agents[id]} className="avatar appel-avatar" />
                      <Media flux={flux[id]} />
                    </>
                  )}
                <span>{nom(id)}{!flux[id] && ' · connexion…'}</span>
              </li>
            ))}
          </ul>

          <div className="appel-boutons">
            <button type="button" aria-pressed={!micro} onClick={basculerMicro}>
              {micro ? 'Couper le micro' : 'Réactiver le micro'}
            </button>
            {appel.video && (
              <button type="button" aria-pressed={!camera} onClick={basculerCamera}>
                {camera ? 'Couper la caméra' : 'Réactiver la caméra'}
              </button>
            )}
            <button type="button" className="appel-raccrocher" onClick={quitter}>Quitter l&apos;appel</button>
          </div>
        </section>
      )}

      {!appel && invitation && (
        <section className="appel appel-invitation" role="alertdialog" aria-label={`Appel de groupe : ${invitation.name}`}>
          <header className="appel-entete">
            <div>
              <strong>Appel {invitation.video ? 'vidéo' : 'audio'} de groupe</strong>
              <small>{invitation.name} · lancé par {agents[invitation.from?.id] ? nom(invitation.from.id) : invitation.from?.badge_number}</small>
            </div>
          </header>
          <div className="appel-boutons">
            <button
              type="button"
              className="appel-accepter"
              onClick={() => rejoindre({ id: invitation.groupId, name: invitation.name }, invitation.video)}
            >
              Rejoindre
            </button>
            <button type="button" onClick={() => setInvitation(null)}>Ignorer</button>
          </div>
        </section>
      )}

      {avis && !appel && <p className="appel-avis" role="status">{avis}</p>}
    </AppelGroupeContext.Provider>
  );
}
