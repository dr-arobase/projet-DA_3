import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as api from '../api.js';
import { useAuth } from '../composants/AuthContext.js';
import { useEvenement, useTempsReel } from '../composants/TempsReelContext.js';
import { IconeRecherche } from '../composants/Icones.jsx';
import { LIBELLES_ROLE, nomAgent } from '../agents.js';
import { formaterDate } from '../registre.js';
import '../styles/registre.css';
import '../styles/pages.css';

const MAX_MESSAGE = 2000; // message.body VARCHAR(2000)

// Messagerie privée entre agents : la conversation choisie est dans l'URL (?avec=<id>)
export default function Messagerie() {
  const { utilisateur } = useAuth();
  const { presence } = useTempsReel();
  const [params, setParams] = useSearchParams();
  const avecId = Number(params.get('avec')) || null;

  const [contacts, setContacts] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [messages, setMessages] = useState([]);
  const [texte, setTexte] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const fin = useRef(null);

  const chargerContacts = useCallback(() => {
    api.listerContacts().then(setContacts).catch((err) => setErreur(err.message));
  }, []);

  useEffect(() => { chargerContacts(); }, [chargerContacts]);

  // Ouvrir une conversation marque ses messages comme lus côté serveur
  useEffect(() => {
    if (!avecId) return undefined;
    let actif = true;
    setMessages([]);
    api.lireConversation(avecId)
      .then((liste) => {
        if (!actif) return;
        setMessages(liste);
        setContacts((enCours) => enCours.map((c) => (c.id === avecId ? { ...c, unread: 0 } : c)));
      })
      .catch((err) => actif && setErreur(err.message));
    return () => { actif = false; };
  }, [avecId]);

  useEffect(() => { fin.current?.scrollIntoView({ block: 'end' }); }, [messages]);

  // Message reçu ou envoyé depuis un autre onglet
  useEvenement('message:new', useCallback((m) => {
    const autre = m.sender_id === utilisateur.id ? m.recipient_id : m.sender_id;
    if (autre === avecId) {
      setMessages((enCours) => (enCours.some((x) => x.id === m.id) ? enCours : [...enCours, m]));
      // Reçu dans la conversation ouverte : on le relit pour le marquer comme lu
      if (m.recipient_id === utilisateur.id) api.lireConversation(avecId).catch(() => {});
    }
    chargerContacts();
  }, [utilisateur.id, avecId, chargerContacts]));

  // L'autre agent a lu nos messages
  useEvenement('message:read', useCallback(({ by }) => {
    if (by !== avecId) return;
    const maintenant = new Date().toISOString();
    setMessages((enCours) => enCours.map((m) => (m.recipient_id === by && !m.read_at ? { ...m, read_at: maintenant } : m)));
  }, [avecId]));

  async function envoyer(e) {
    e.preventDefault();
    const corps = texte.trim();
    if (!corps || !avecId) return;
    setEnCours(true);
    try {
      const { data } = await api.envoyerMessage(avecId, corps);
      setMessages((enCours) => (enCours.some((x) => x.id === data.id) ? enCours : [...enCours, data]));
      setTexte('');
      setErreur('');
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  }

  const enLigne = new Set(presence.map((p) => p.id));
  const terme = recherche.trim().toLowerCase();
  const filtres = contacts.filter((c) => !terme || `${nomAgent(c)} ${c.badge_number}`.toLowerCase().includes(terme));
  const correspondant = contacts.find((c) => c.id === avecId);

  return (
    <>
      <header className="entete-registre">
        <div>
          <h1>Messagerie</h1>
          <p>Messages privés entre agents, reçus en direct</p>
        </div>
      </header>

      <div className="page messagerie">
        <aside className="carte messagerie-contacts">
          <label className="registre-recherche">
            <IconeRecherche taille={15} />
            <input type="search" placeholder="Chercher un agent…" aria-label="Chercher un agent" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          </label>
          <ul>
            {filtres.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`messagerie-contact${c.id === avecId ? ' actif' : ''}`}
                  onClick={() => setParams({ avec: c.id })}
                >
                  <span className={`messagerie-presence${enLigne.has(c.id) ? ' en-ligne' : ''}`} aria-label={enLigne.has(c.id) ? 'En ligne' : 'Hors ligne'} />
                  <span className="messagerie-nom">
                    {nomAgent(c)}
                    <small>{c.badge_number} · {LIBELLES_ROLE[c.role]}</small>
                  </span>
                  {c.unread > 0 && <span className="messagerie-non-lus" aria-label={`${c.unread} non lus`}>{c.unread}</span>}
                </button>
              </li>
            ))}
            {filtres.length === 0 && <li className="registre-note">Aucun agent.</li>}
          </ul>
        </aside>

        <section className="carte messagerie-fil">
          {!correspondant ? (
            <p className="messagerie-vide">Choisissez un agent pour commencer une conversation.</p>
          ) : (
            <>
              <header className="messagerie-entete">
                <strong>{nomAgent(correspondant)}</strong>
                <small>{enLigne.has(correspondant.id) ? 'En ligne' : 'Hors ligne'}</small>
              </header>

              <ol className="messagerie-messages">
                {messages.map((m) => {
                  const moi = m.sender_id === utilisateur.id;
                  return (
                    <li key={m.id} className={`messagerie-bulle${moi ? ' moi' : ''}`}>
                      <p>{m.body}</p>
                      <small>
                        {formaterDate(m.created_at, true)}
                        {moi && (m.read_at ? ' · Lu' : ' · Envoyé')}
                      </small>
                    </li>
                  );
                })}
                {messages.length === 0 && <li className="messagerie-vide">Aucun message pour l'instant.</li>}
                <li ref={fin} aria-hidden="true" />
              </ol>

              {erreur && <p className="registre-message erreur" role="alert">{erreur}</p>}

              <form className="messagerie-saisie" onSubmit={envoyer}>
                <textarea
                  rows={2}
                  maxLength={MAX_MESSAGE}
                  placeholder={`Écrire à ${correspondant.first_name}…`}
                  aria-label="Message"
                  value={texte}
                  onChange={(e) => setTexte(e.target.value)}
                  onKeyDown={(e) => {
                    // Entrée envoie, Maj+Entrée va à la ligne
                    if (e.key === 'Enter' && !e.shiftKey) envoyer(e);
                  }}
                />
                <button type="submit" className="registre-bouton-principal" disabled={enCours || !texte.trim()}>
                  Envoyer
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </>
  );
}
