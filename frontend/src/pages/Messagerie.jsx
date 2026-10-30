import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as api from '../api.js';
import { useAuth } from '../composants/AuthContext.js';
import { useEvenement, useTempsReel } from '../composants/TempsReelContext.js';
import { useAppel } from '../composants/AppelContext.js';
import {
  IconeRecherche, IconeGroupe, IconePlus, IconeQuitter, IconeTelephone, IconeCamera, IconeInfo,
  IconeSourire, IconeMicro, IconeImage, IconeTrombone,
} from '../composants/Icones.jsx';
import SelecteurEmojis from '../composants/SelecteurEmojis.jsx';
import Avatar from '../composants/Avatar.jsx';
import SelecteurAgents from '../composants/SelecteurAgents.jsx';
import { LIBELLES_ROLE, nomAgent } from '../agents.js';
import '../styles/registre.css';
import '../styles/pages.css';

const MAX_MESSAGE = 2000; // message.body VARCHAR(2000)
const MAX_NOM_GROUPE = 100; // message_group.name VARCHAR(100)
const DELAI_MODIFICATION = 15 * 60 * 1000; // le serveur refuse aussi après 15 minutes (#143)
const ECART_HEURE = 15 * 60 * 1000; // l'heure s'affiche au centre du fil après 15 minutes de silence
const MAX_FICHIER = 10 * 1024 * 1024; // 10 Mo, comme le serveur (#57)
const DUREE_MAX_VOCAL = 120; // secondes (#59)
const TYPES_FICHIER = 'image/jpeg,image/png,image/webp,image/gif,application/pdf,audio/webm,audio/ogg,audio/mp4,audio/mpeg';

// « 1,4 Mo », « 320 ko »
const tailleLisible = (octets) => (octets >= 1024 * 1024
  ? `${(octets / 1024 / 1024).toLocaleString('fr-CA', { maximumFractionDigits: 1 })} Mo`
  : `${Math.max(1, Math.round(octets / 1024))} ko`);
const dureeLisible = (secondes) => `${Math.floor(secondes / 60)}:${String(secondes % 60).padStart(2, '0')}`;

// Format d'enregistrement que le navigateur sait produire (Chrome et Firefox : WebM, Safari : MP4)
const formatVocal = () => (typeof MediaRecorder === 'undefined' ? null
  : ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
    .find((t) => MediaRecorder.isTypeSupported(t)) ?? '');

// Séparateur de jour (« mar. 20 janv. ») et heure d'un message
const jourDe = (iso) => new Date(iso).toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' });
const heureDe = (iso) => new Date(iso).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });

const libelleAgent = (a) => `${a.badge_number} · ${nomAgent(a)}`;

// Messagerie : conversations à deux (?avec=<id agent>) et groupes (?groupe=<id groupe>).
// La liste ne montre que les conversations existantes; la recherche trouve tous les agents.
export default function Messagerie() {
  const { utilisateur } = useAuth();
  const { presence } = useTempsReel();
  const { appeler, enAppel } = useAppel();
  const [params, setParams] = useSearchParams();
  const avecId = Number(params.get('avec')) || null;
  const groupeId = Number(params.get('groupe')) || null;

  const [contacts, setContacts] = useState([]); // tous les agents actifs, avec non-lus et dernier échange
  const [groupes, setGroupes] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [messages, setMessages] = useState([]);
  const [groupe, setGroupe] = useState(null); // groupe ouvert, avec ses membres
  const [texte, setTexte] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [panneau, setPanneau] = useState(null); // 'nouveau-groupe' | 'membres' | null
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState(null); // mon message en cours de modification
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [vocal, setVocal] = useState(null); // { secondes } pendant un enregistrement
  const [emojisOuverts, setEmojisOuverts] = useState(false);
  const fin = useRef(null);
  const menu = useRef(null);
  const saisie = useRef(null);
  const choixFichier = useRef(null);
  const enregistreur = useRef(null); // { recorder, flux, annule, minuterie }

  // Le bouton « Modifier » disparaît de lui-même quand les 15 minutes sont passées
  useEffect(() => {
    const minuterie = window.setInterval(() => setMaintenant(Date.now()), 30 * 1000);
    return () => window.clearInterval(minuterie);
  }, []);

  useEffect(() => {
    const fermer = (event) => {
      if (!menu.current?.contains(event.target)) setMenuOuvert(false);
    };
    document.addEventListener('mousedown', fermer);
    return () => document.removeEventListener('mousedown', fermer);
  }, []);

  const chargerContacts = useCallback(() => {
    api.listerContacts().then(setContacts).catch((err) => setErreur(err.message));
  }, []);
  const chargerGroupes = useCallback(() => {
    api.listerGroupes().then(setGroupes).catch((err) => setErreur(err.message));
  }, []);

  useEffect(() => {
    chargerContacts();
    chargerGroupes();
  }, [chargerContacts, chargerGroupes]);

  // Ouvrir une conversation marque ses messages comme lus côté serveur
  const ouvrir = useCallback((actif = () => true) => {
    if (groupeId) {
      return api.lireGroupe(groupeId).then(({ group, messages: liste }) => {
        if (!actif()) return;
        setGroupe(group);
        setMessages(liste);
        setGroupes((enCours) => enCours.map((g) => (g.id === groupeId ? { ...g, unread: 0 } : g)));
      });
    }
    return api.lireConversation(avecId).then((liste) => {
      if (!actif()) return;
      setMessages(liste);
      setContacts((enCours) => enCours.map((c) => (c.id === avecId ? { ...c, unread: 0 } : c)));
    });
  }, [avecId, groupeId]);

  useEffect(() => {
    setMessages([]);
    setGroupe(null);
    setMenuOuvert(false);
    setEnEdition(null);
    setErreur('');
    if (!avecId && !groupeId) return undefined;
    let actif = true;
    ouvrir(() => actif).catch((err) => actif && setErreur(err.message));
    return () => { actif = false; };
  }, [avecId, groupeId, ouvrir]);

  useEffect(() => { fin.current?.scrollIntoView({ block: 'end' }); }, [messages]);

  const ajouterMessage = (m) =>
    setMessages((enCours) => (enCours.some((x) => x.id === m.id) ? enCours : [...enCours, m]));

  // Message modifié ou supprimé : on garde le nom de l'auteur déjà affiché, on remplace le reste
  const remplacerMessage = useCallback((m) => {
    setMessages((enCours) => enCours.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
  }, []);

  // Message à deux reçu, ou envoyé depuis un autre onglet
  useEvenement('message:new', useCallback((m) => {
    const autre = m.sender_id === utilisateur.id ? m.recipient_id : m.sender_id;
    if (autre === avecId) {
      ajouterMessage(m);
      // Reçu dans la conversation ouverte : on la relit pour le marquer comme lu
      if (m.recipient_id === utilisateur.id) api.lireConversation(avecId).catch(() => {});
    }
    chargerContacts();
  }, [utilisateur.id, avecId, chargerContacts]));

  // Un participant a modifié ou supprimé son message (privé ou de groupe)
  useEvenement('message:updated', remplacerMessage);
  useEvenement('message:deleted', useCallback((m) => {
    remplacerMessage(m);
    setEnEdition((enCours) => (enCours?.id === m.id ? null : enCours));
    if (m.group_id) chargerGroupes(); else chargerContacts();
  }, [remplacerMessage, chargerContacts, chargerGroupes]));

  // L'autre agent a lu nos messages
  useEvenement('message:read', useCallback(({ by }) => {
    if (by !== avecId) return;
    const maintenant = new Date().toISOString();
    setMessages((enCours) => enCours.map((m) => (m.recipient_id === by && !m.read_at ? { ...m, read_at: maintenant } : m)));
  }, [avecId]));

  useEvenement('group:message', useCallback((m) => {
    if (m.group_id === groupeId) {
      ajouterMessage(m);
      if (m.sender_id !== utilisateur.id) api.lireGroupe(groupeId).catch(() => {});
    }
    chargerGroupes();
  }, [utilisateur.id, groupeId, chargerGroupes]));

  // Groupe créé, membres ajoutés ou retirés : on recharge; retiré du groupe ouvert, on le ferme
  useEvenement('group:updated', useCallback(({ group_id: id }) => {
    chargerGroupes();
    if (id !== groupeId) return;
    api.lireGroupe(groupeId)
      .then(({ group }) => setGroupe(group))
      .catch((err) => {
        if (err.status === 403 || err.status === 404) setParams({});
      });
  }, [groupeId, chargerGroupes, setParams]));

  async function envoyer(e) {
    e.preventDefault();
    const corps = texte.trim();
    if (!corps || (!avecId && !groupeId)) return;
    setEnCours(true);
    try {
      if (enEdition) {
        const { data } = await api.modifierMessage(enEdition.id, corps);
        remplacerMessage(data);
        setEnEdition(null);
      } else {
        const { data } = groupeId ? await api.envoyerAuGroupe(groupeId, corps) : await api.envoyerMessage(avecId, corps);
        ajouterMessage(data);
      }
      setTexte('');
      setErreur('');
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  }

  // Fichier, image, GIF ou message vocal : envoyé tout de suite dans la conversation ouverte
  async function envoyerFichier(fichier, nom) {
    if (fichier.size > MAX_FICHIER) return setErreur('Le fichier dépasse 10 Mo.');
    setEnCours(true);
    try {
      const { data } = await api.envoyerFichier({ agentId: avecId, groupeId, fichier, nom });
      ajouterMessage(data);
      setErreur('');
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
    return undefined;
  }

  function fichierChoisi(e) {
    const fichier = e.target.files?.[0];
    e.target.value = ''; // permet de renvoyer le même fichier
    if (fichier) envoyerFichier(fichier, fichier.name);
  }

  async function demarrerVocal() {
    const format = formatVocal();
    if (format === null || !navigator.mediaDevices?.getUserMedia) {
      setErreur('Ce navigateur ne peut pas enregistrer de message vocal.');
      return;
    }
    let flux;
    try {
      flux = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErreur('Micro refusé : autorisez le micro pour ce site dans le navigateur, puis réessayez.');
      return;
    }
    const recorder = new MediaRecorder(flux, format ? { mimeType: format } : undefined);
    const morceaux = [];
    recorder.ondataavailable = (e) => { if (e.data.size) morceaux.push(e.data); };
    recorder.onstop = () => {
      const { annule, minuterie } = enregistreur.current ?? {};
      window.clearTimeout(minuterie);
      flux.getTracks().forEach((piste) => piste.stop());
      enregistreur.current = null;
      setVocal(null);
      if (annule || morceaux.length === 0) return;
      const type = recorder.mimeType || format || 'audio/webm';
      const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
      envoyerFichier(new Blob(morceaux, { type }), `message-vocal.${extension}`);
    };
    recorder.start();
    // Arrêt et envoi automatiques à 2 minutes
    const minuterie = window.setTimeout(() => recorder.state !== 'inactive' && recorder.stop(), DUREE_MAX_VOCAL * 1000);
    enregistreur.current = { recorder, annule: false, minuterie };
    setErreur('');
    setVocal({ secondes: 0 });
  }

  function arreterVocal(annuler) {
    const courant = enregistreur.current;
    if (!courant || courant.recorder.state === 'inactive') return;
    courant.annule = annuler;
    courant.recorder.stop();
  }

  // Durée affichée pendant l'enregistrement
  const enregistrementEnCours = Boolean(vocal);
  useEffect(() => {
    if (!enregistrementEnCours) return undefined;
    const debut = Date.now();
    const minuterie = window.setInterval(
      () => setVocal({ secondes: Math.min(DUREE_MAX_VOCAL, Math.floor((Date.now() - debut) / 1000)) }), 500,
    );
    return () => window.clearInterval(minuterie);
  }, [enregistrementEnCours]);

  // Changer de conversation ou quitter la page annule l'enregistrement en cours (et coupe le micro)
  useEffect(() => () => arreterVocal(true), [avecId, groupeId]);

  // L'émoji choisi va à la position du curseur dans le champ
  const fermerEmojis = useCallback(() => setEmojisOuverts(false), []);
  function insererEmoji(emoji) {
    const champ = saisie.current;
    const debut = champ?.selectionStart ?? texte.length;
    const finSelection = champ?.selectionEnd ?? texte.length;
    setTexte((t) => (t.slice(0, debut) + emoji + t.slice(finSelection)).slice(0, MAX_MESSAGE));
    requestAnimationFrame(() => {
      champ?.focus();
      champ?.setSelectionRange(debut + emoji.length, debut + emoji.length);
    });
  }

  function commencerEdition(m) {
    setEnEdition(m);
    setTexte(m.body);
    setErreur('');
    saisie.current?.focus();
  }

  function annulerEdition() {
    setEnEdition(null);
    setTexte('');
  }

  async function supprimer(m) {
    if (!window.confirm('Supprimer ce message ? Il sera remplacé par « Message supprimé » pour tout le monde.')) return;
    try {
      const { data } = await api.supprimerMessage(m.id);
      remplacerMessage(data);
      if (enEdition?.id === m.id) annulerEdition();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function quitterGroupe() {
    if (!window.confirm(`Quitter le groupe « ${groupe.name} » ? Vous ne recevrez plus ses messages.`)) return;
    try {
      await api.retirerMembre(groupe.id, utilisateur.id);
      setPanneau(null);
      setParams({});
      chargerGroupes();
    } catch (err) {
      setErreur(err.message);
    }
  }

  function choisir(nouveauxParams) {
    setPanneau(null);
    setRecherche('');
    setParams(nouveauxParams);
  }

  const enLigne = new Set(presence.map((p) => p.id));
  const terme = recherche.trim().toLowerCase();

  const elementAgent = (c) => ({ cle: `a${c.id}`, agent: c, date: c.last_message_at, unread: Number(c.unread) || 0 });
  const elementGroupe = (g) => ({ cle: `g${g.id}`, groupe: g, date: g.last_message_at ?? g.created_at, unread: Number(g.unread) || 0 });

  // Sans recherche : seulement les conversations existantes, la plus récente en haut.
  // Avec recherche : les groupes et TOUS les agents qui correspondent, pour commencer une conversation.
  const liste = terme
    ? [
      ...groupes.filter((g) => g.name.toLowerCase().includes(terme)).map(elementGroupe),
      ...contacts.filter((c) => libelleAgent(c).toLowerCase().includes(terme)).map(elementAgent),
    ]
    : [
      ...contacts.filter((c) => c.last_message_at || c.id === avecId).map(elementAgent),
      ...groupes.map(elementGroupe),
    ].sort((a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0));

  const correspondant = contacts.find((c) => c.id === avecId);
  const ouvert = groupeId ? groupe : correspondant;

  return (
    <>
      <header className="entete-registre">
        <div>
          <h1>Messagerie</h1>
          <p>Messages privés et groupes entre agents, reçus en direct</p>
        </div>
      </header>

      <div className="page messagerie">
        <aside className="carte messagerie-contacts">
          <div className="messagerie-outils">
            <label className="registre-recherche">
              <IconeRecherche taille={15} />
              <input
                type="search"
                placeholder="Matricule, nom ou groupe…"
                aria-label="Chercher un agent ou un groupe"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="messagerie-bouton-icone"
              title="Nouveau groupe"
              aria-label="Nouveau groupe"
              onClick={() => setPanneau('nouveau-groupe')}
            >
              <IconePlus taille={18} />
            </button>
          </div>

          <ul>
            {liste.map(({ cle, agent, groupe: g, unread }) => {
              const actif = agent ? agent.id === avecId : g.id === groupeId;
              return (
                <li key={cle}>
                  <button
                    type="button"
                    className={`messagerie-contact${actif ? ' actif' : ''}`}
                    onClick={() => choisir(agent ? { avec: agent.id } : { groupe: g.id })}
                  >
                    {agent ? (
                      <span className="messagerie-pastille">
                        <Avatar utilisateur={agent} className="avatar messagerie-avatar" />
                        <span
                          className={`messagerie-presence${enLigne.has(agent.id) ? ' en-ligne' : ''}`}
                          aria-label={enLigne.has(agent.id) ? 'En ligne' : 'Hors ligne'}
                        />
                      </span>
                    ) : (
                      <span className="avatar messagerie-avatar messagerie-avatar-groupe" aria-hidden="true"><IconeGroupe taille={16} /></span>
                    )}
                    <span className="messagerie-nom">
                      {agent ? nomAgent(agent) : g.name}
                      <small>
                        {agent
                          ? `${agent.badge_number} · ${LIBELLES_ROLE[agent.role]}`
                          : `Groupe · ${g.members.length} membres`}
                      </small>
                    </span>
                    {unread > 0 && <span className="messagerie-non-lus" aria-label={`${unread} non lus`}>{unread}</span>}
                  </button>
                </li>
              );
            })}
            {liste.length === 0 && (
              <li className="registre-note">
                {terme ? 'Aucun agent ni groupe.' : 'Aucune conversation. Cherchez un agent pour lui écrire.'}
              </li>
            )}
          </ul>
        </aside>

        <section className="carte messagerie-fil">
          {panneau === 'nouveau-groupe' ? (
            <NouveauGroupe
              agents={contacts}
              onAnnuler={() => setPanneau(null)}
              onCree={(g) => {
                chargerGroupes();
                choisir({ groupe: g.id });
              }}
            />
          ) : panneau === 'membres' && groupe ? (
            <MembresGroupe
              groupe={groupe}
              agents={contacts}
              moiId={utilisateur.id}
              onFermer={() => setPanneau(null)}
              onQuitter={quitterGroupe}
            />
          ) : !ouvert ? (
            <p className="messagerie-vide">
              {avecId || groupeId ? 'Chargement…' : 'Choisissez une conversation, ou cherchez un agent pour lui écrire.'}
            </p>
          ) : (
            <>
              <header className="messagerie-entete">
                {groupeId ? (
                  <span className="avatar messagerie-avatar messagerie-avatar-groupe" aria-hidden="true"><IconeGroupe taille={16} /></span>
                ) : (
                  <Avatar utilisateur={correspondant} className="avatar messagerie-avatar" />
                )}
                <div className="messagerie-entete-titre">
                  <strong>{groupeId ? groupe.name : nomAgent(correspondant)}</strong>
                  <small>
                    {groupeId
                      ? groupe.members.map((m) => m.first_name).join(', ')
                      : `${correspondant.badge_number} · ${enLigne.has(correspondant.id) ? 'En ligne' : 'Hors ligne'}`}
                  </small>
                </div>
                {!groupeId && (
                  // Appels à deux seulement, vers un agent connecté (#56)
                  <div className="messagerie-appels">
                    {[[false, IconeTelephone, 'Appel audio'], [true, IconeCamera, 'Appel vidéo']].map(([video, Icone, libelle]) => (
                      <button
                        key={libelle}
                        type="button"
                        className="messagerie-icone"
                        aria-label={`${libelle} avec ${nomAgent(correspondant)}`}
                        title={libelle}
                        disabled={enAppel}
                        onClick={() => {
                          // Toujours cliquable : hors ligne, on explique pourquoi l'appel est impossible
                          if (!enLigne.has(correspondant.id)) {
                            setErreur(`${nomAgent(correspondant)} est hors ligne : l'appel n'est possible que si l'agent est connecté.`);
                            return;
                          }
                          setErreur('');
                          appeler(correspondant, video);
                        }}
                      >
                        <Icone taille={24} />
                      </button>
                    ))}
                  </div>
                )}
                {groupeId && (
                  <div className="messagerie-menu" ref={menu}>
                    <button
                      type="button"
                      className="messagerie-icone"
                      aria-label="Informations du groupe"
                      title="Informations du groupe"
                      aria-expanded={menuOuvert}
                      onClick={() => setMenuOuvert((o) => !o)}
                      onKeyDown={(e) => e.key === 'Escape' && setMenuOuvert(false)}
                    >
                      <IconeInfo taille={24} />
                    </button>
                    {menuOuvert && (
                      <ul className="carte messagerie-menu-liste" role="menu">
                        <li>
                          <button type="button" role="menuitem" onClick={() => { setMenuOuvert(false); setPanneau('membres'); }}>
                            <IconeGroupe taille={16} /> Membres
                          </button>
                        </li>
                        <li>
                          <button type="button" role="menuitem" onClick={() => { setMenuOuvert(false); quitterGroupe(); }}>
                            <IconeQuitter taille={16} /> Quitter la conversation
                          </button>
                        </li>
                      </ul>
                    )}
                  </div>
                )}
              </header>

              <ol className="messagerie-messages">
                {messages.map((m, i) => {
                  const moi = m.sender_id === utilisateur.id;
                  const precedent = messages[i - 1];
                  const suivant = messages[i + 1];
                  const nouveauJour = !precedent || jourDe(precedent.created_at) !== jourDe(m.created_at);
                  // L'heure au centre du fil : nouveau jour, ou 15 minutes sans message
                  const heureAuCentre = nouveauJour
                    || new Date(m.created_at) - new Date(precedent.created_at) >= ECART_HEURE;
                  const suite = !heureAuCentre && precedent.sender_id === m.sender_id;
                  const auteur = groupeId
                    ? { first_name: m.sender_first_name, last_name: m.sender_last_name }
                    : correspondant;
                  const supprime = Boolean(m.deleted_at);
                  // Une pièce jointe ne se modifie pas : on la supprime et on en renvoie une autre
                  const modifiable = moi && !supprime && !m.attachment_kind
                    && maintenant - new Date(m.created_at).getTime() < DELAI_MODIFICATION;
                  // Image ou GIF seul : affiché en grand, sans bulle autour
                  const media = !supprime && m.attachment_kind === 'image' && !m.body;
                  // « Vu » ou « Envoyé » sous mon dernier message seulement (conversation à deux)
                  const statut = moi && !groupeId && !supprime && !messages.slice(i + 1).some((x) => x.sender_id === utilisateur.id);
                  const finDeSerie = !suivant || suivant.sender_id !== m.sender_id;
                  const classes = [
                    'messagerie-bulle', moi && 'moi', supprime && 'supprime', media && 'media',
                    !supprime && m.attachment_kind === 'audio' && 'vocal', enEdition?.id === m.id && 'en-edition',
                  ].filter(Boolean).join(' ');
                  return (
                    <Fragment key={m.id}>
                      {heureAuCentre && (
                        <li className="messagerie-jour">
                          {nouveauJour ? `${jourDe(m.created_at)} · ${heureDe(m.created_at)}` : heureDe(m.created_at)}
                        </li>
                      )}
                      <li className={`messagerie-ligne${moi ? ' moi' : ''}${suite ? ' suite' : ''}`}>
                        {!moi && (finDeSerie
                          ? <Avatar utilisateur={auteur} className="avatar messagerie-avatar" />
                          : <span className="messagerie-avatar-vide" aria-hidden="true" />)}
                        <div className="messagerie-colonne">
                          {groupeId && !moi && !suite && <strong className="messagerie-auteur">{nomAgent(auteur)}</strong>}
                          <div className={classes} title={heureDe(m.created_at)}>
                            {supprime && <p className="messagerie-supprime">Message supprimé</p>}
                            {!supprime && m.attachment_kind && <PieceJointe message={m} />}
                            {!supprime && m.body && <p>{m.body}</p>}
                            {m.edited_at && !supprime && <small>modifié</small>}
                          </div>
                          {(statut || (moi && !supprime)) && (
                            <span className="messagerie-meta">
                              {moi && !supprime && (
                                <span className="messagerie-actions">
                                  {modifiable && (
                                    <button type="button" onClick={() => commencerEdition(m)} aria-label="Modifier ce message">Modifier</button>
                                  )}
                                  <button type="button" onClick={() => supprimer(m)} aria-label="Supprimer ce message">Supprimer</button>
                                </span>
                              )}
                              {statut && <span className="messagerie-statut">{m.read_at ? 'Vu' : 'Envoyé'}</span>}
                            </span>
                          )}
                        </div>
                      </li>
                    </Fragment>
                  );
                })}
                {messages.length === 0 && <li className="messagerie-vide">Aucun message pour l'instant.</li>}
                <li ref={fin} aria-hidden="true" />
              </ol>

              {erreur && <p className="registre-message erreur" role="alert">{erreur}</p>}

              {enEdition && (
                <p className="messagerie-edition" role="status">
                  Modification du message · <kbd>Échap</kbd> pour annuler
                  <button type="button" onClick={annulerEdition}>Annuler</button>
                </p>
              )}
              {/* Barre de saisie arrondie : émojis à gauche ; micro, image et fichier à droite.
                  Dès qu'on écrit, « Envoyer » remplace le micro et l'image. */}
              <form className="messagerie-saisie" onSubmit={envoyer}>
                <input ref={choixFichier} type="file" accept={TYPES_FICHIER} hidden onChange={fichierChoisi} />
                {vocal ? (
                  <div className="messagerie-vocal" role="status">
                    <span className="messagerie-vocal-point" aria-hidden="true" />
                    Enregistrement… {dureeLisible(vocal.secondes)} / {dureeLisible(DUREE_MAX_VOCAL)}
                    <button type="button" className="messagerie-lien" onClick={() => arreterVocal(true)}>Annuler</button>
                    <button type="button" className="messagerie-envoyer" onClick={() => arreterVocal(false)}>Envoyer</button>
                  </div>
                ) : (
                  <div className="messagerie-barre">
                    <div className="messagerie-emojis">
                      <button
                        type="button"
                        className="messagerie-icone"
                        aria-label="Émojis"
                        aria-expanded={emojisOuverts}
                        onClick={() => setEmojisOuverts((o) => !o)}
                      >
                        <IconeSourire taille={24} />
                      </button>
                      {emojisOuverts && <SelecteurEmojis onChoisir={insererEmoji} onFermer={fermerEmojis} />}
                    </div>
                    <textarea
                      ref={saisie}
                      rows={1}
                      maxLength={MAX_MESSAGE}
                      placeholder={enEdition ? 'Modifier le message…' : 'Votre message…'}
                      aria-label={enEdition ? 'Modifier le message' : `Message à ${groupeId ? groupe.name : nomAgent(correspondant)}`}
                      value={texte}
                      onChange={(e) => setTexte(e.target.value)}
                      onKeyDown={(e) => {
                        // Entrée envoie, Maj+Entrée va à la ligne, Échap annule une modification
                        if (e.key === 'Enter' && !e.shiftKey) envoyer(e);
                        if (e.key === 'Escape' && enEdition) annulerEdition();
                      }}
                    />
                    {texte.trim() ? (
                      <button type="submit" className="messagerie-envoyer" disabled={enCours}>
                        {enEdition ? 'Enregistrer' : 'Envoyer'}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="messagerie-icone"
                          aria-label="Enregistrer un message vocal"
                          title="Message vocal (2 minutes)"
                          disabled={enCours || Boolean(enEdition)}
                          onClick={demarrerVocal}
                        >
                          <IconeMicro taille={24} />
                        </button>
                        <button
                          type="button"
                          className="messagerie-icone"
                          aria-label="Envoyer une image ou un GIF"
                          title="Image ou GIF (10 Mo)"
                          disabled={enCours || Boolean(enEdition)}
                          onClick={() => {
                            choixFichier.current.accept = 'image/jpeg,image/png,image/webp,image/gif';
                            choixFichier.current.click();
                          }}
                        >
                          <IconeImage taille={24} />
                        </button>
                        <button
                          type="button"
                          className="messagerie-icone"
                          aria-label="Joindre un fichier (PDF, audio)"
                          title="Fichier : PDF ou audio (10 Mo)"
                          disabled={enCours || Boolean(enEdition)}
                          onClick={() => {
                            choixFichier.current.accept = TYPES_FICHIER;
                            choixFichier.current.click();
                          }}
                        >
                          <IconeTrombone taille={24} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </form>
            </>
          )}
        </section>
      </div>
    </>
  );
}

// Pièce jointe dans le fil : image (GIF compris) cliquable, lecteur audio, ou lien de téléchargement
function PieceJointe({ message: m }) {
  const url = api.urlPieceJointe(m.id);
  if (m.attachment_kind === 'image') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="messagerie-image">
        <img src={url} alt={m.attachment_name} loading="lazy" />
      </a>
    );
  }
  if (m.attachment_kind === 'audio') return <LecteurVocal url={url} />;
  return (
    <a href={url} className="messagerie-fichier" download={m.attachment_name}>
      <IconeTrombone taille={18} />
      <span>{m.attachment_name}</span>
      {m.attachment_size ? <small>{tailleLisible(m.attachment_size)}</small> : null}
    </a>
  );
}

// Message vocal : lecture / pause, barre de progression qu'on peut déplacer, durée
function LecteurVocal({ url }) {
  const audio = useRef(null);
  const [lecture, setLecture] = useState(false);
  const [position, setPosition] = useState(0);
  const [duree, setDuree] = useState(0);

  // Chrome ne connaît pas la durée d'un WebM enregistré par le navigateur (« Infinity ») :
  // on saute à la fin pour la lui faire calculer, puis on revient au début
  function metadonnees() {
    const a = audio.current;
    if (Number.isFinite(a.duration)) return setDuree(a.duration);
    const revenir = () => {
      a.removeEventListener('timeupdate', revenir);
      setDuree(Number.isFinite(a.duration) ? a.duration : 0);
      a.currentTime = 0;
    };
    a.addEventListener('timeupdate', revenir);
    a.currentTime = 1e101;
    return undefined;
  }

  function basculer() {
    const a = audio.current;
    if (a.paused) a.play().catch(() => {}); else a.pause();
  }

  const secondes = (s) => dureeLisible(Math.round(Number.isFinite(s) ? s : 0));
  return (
    <div className="lecteur-vocal">
      <audio
        ref={audio}
        src={url}
        preload="metadata"
        onLoadedMetadata={metadonnees}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
        onPlay={() => setLecture(true)}
        onPause={() => setLecture(false)}
        onEnded={() => { setLecture(false); setPosition(0); }}
      />
      <button type="button" className="lecteur-vocal-bouton" onClick={basculer} aria-label={lecture ? 'Pause' : 'Écouter le message vocal'}>
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
          {lecture ? <path d="M6 4h4v16H6zM14 4h4v16h-4z" /> : <path d="M7 4v16l13-8z" />}
        </svg>
      </button>
      <input
        type="range"
        className="lecteur-vocal-barre"
        min={0}
        max={duree || 1}
        step="any"
        value={Math.min(position, duree || 1)}
        aria-label="Position dans le message vocal"
        onChange={(e) => { audio.current.currentTime = Number(e.target.value); setPosition(Number(e.target.value)); }}
        style={{ '--progression': `${duree ? (position / duree) * 100 : 0}%` }}
      />
      <span className="lecteur-vocal-temps">{lecture || position ? secondes(position) : secondes(duree)}</span>
    </div>
  );
}

// Création d'un groupe : un nom et au moins un autre agent
function NouveauGroupe({ agents, onAnnuler, onCree }) {
  const [nom, setNom] = useState('');
  const [choisis, setChoisis] = useState([]);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function creer(e) {
    e.preventDefault();
    if (!nom.trim()) return setErreur('Donnez un nom au groupe.');
    if (choisis.length === 0) return setErreur('Choisissez au moins un agent.');
    setEnCours(true);
    try {
      onCree(await api.creerGroupe(nom.trim(), choisis));
    } catch (err) {
      setErreur(err.message);
      setEnCours(false);
    }
    return undefined;
  }

  return (
    <form className="messagerie-panneau" onSubmit={creer}>
      <h2>Nouveau groupe</h2>
      <label className="messagerie-champ">
        Nom du groupe
        <input
          type="text"
          maxLength={MAX_NOM_GROUPE}
          placeholder="Patrouille secteur nord"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
        />
      </label>
      <p className="messagerie-champ">Membres ({choisis.length} choisi{choisis.length > 1 ? 's' : ''})</p>
      <SelecteurAgents agents={agents} choisis={choisis} onChange={setChoisis} />
      {erreur && <p className="registre-message erreur" role="alert">{erreur}</p>}
      <div className="messagerie-panneau-actions">
        <button type="button" className="registre-lien" onClick={onAnnuler}>Annuler</button>
        <button type="submit" className="registre-bouton-principal" disabled={enCours}>Créer le groupe</button>
      </div>
    </form>
  );
}

// Membres d'un groupe : le créateur ajoute et retire; chacun peut quitter
function MembresGroupe({ groupe, agents, moiId, onFermer, onQuitter }) {
  const [choisis, setChoisis] = useState([]);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const estCreateur = groupe.created_by === moiId;
  const idsMembres = new Set(groupe.members.map((m) => m.id));

  async function agir(action) {
    setEnCours(true);
    setErreur('');
    try {
      await action();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="messagerie-panneau">
      <h2>Membres de « {groupe.name} »</h2>
      <ul className="messagerie-membres">
        {groupe.members.map((m) => (
          <li key={m.id}>
            <span>{libelleAgent(m)}{m.id === groupe.created_by && <small> · gère le groupe</small>}{m.id === moiId && <small> · vous</small>}</span>
            {estCreateur && m.id !== moiId && (
              <button
                type="button"
                className="registre-lien"
                disabled={enCours}
                onClick={() => agir(() => api.retirerMembre(groupe.id, m.id))}
              >
                Retirer
              </button>
            )}
          </li>
        ))}
      </ul>

      {estCreateur && (
        <>
          <p className="messagerie-champ">Ajouter des membres</p>
          <SelecteurAgents agents={agents.filter((a) => !idsMembres.has(a.id))} choisis={choisis} onChange={setChoisis} />
          <button
            type="button"
            className="registre-bouton-principal"
            disabled={enCours || choisis.length === 0}
            onClick={() => agir(async () => { await api.ajouterMembres(groupe.id, choisis); setChoisis([]); })}
          >
            Ajouter {choisis.length > 0 ? `(${choisis.length})` : ''}
          </button>
        </>
      )}

      {erreur && <p className="registre-message erreur" role="alert">{erreur}</p>}
      <div className="messagerie-panneau-actions">
        <button type="button" className="registre-lien" onClick={onQuitter}>Quitter le groupe</button>
        <button type="button" className="registre-bouton-principal" onClick={onFermer}>Retour à la conversation</button>
      </div>
    </div>
  );
}
