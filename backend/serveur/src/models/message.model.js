import { pool } from '../config/db.js';

// Réactions d'un message (alias m), en JSON : [{ emoji, user_ids }], la plus ancienne d'abord
export const REACTIONS = `
  (SELECT COALESCE(json_agg(json_build_object('emoji', r.emoji, 'user_ids', r.user_ids) ORDER BY r.premiere), '[]')
   FROM (SELECT emoji, array_agg(user_id ORDER BY created_at) AS user_ids, MIN(created_at) AS premiere
         FROM message_reaction WHERE message_id = m.id GROUP BY emoji) r) AS reactions
`;

const SELECT_MESSAGE = `
  SELECT m.id, m.sender_id, m.recipient_id, m.body, m.created_at, m.read_at, m.edited_at, m.deleted_at,
         m.attachment_name, m.attachment_type, m.attachment_size, m.attachment_kind, m.kind,
         ${REACTIONS}
  FROM message m
`;

// Champs renvoyés après un envoi, une modification ou une suppression (message privé ou de groupe).
// Le chemin du fichier sur le disque n'est jamais renvoyé au navigateur.
const RETURNING_MESSAGE = `RETURNING id, sender_id, recipient_id, group_id, body, kind, created_at, read_at, edited_at, deleted_at,
  attachment_name, attachment_type, attachment_size, attachment_kind`;

// Délai pendant lequel l'expéditeur peut modifier son message (#143)
export const EDIT_WINDOW_MINUTES = 15;

// Agents actifs à qui écrire, avec le nombre de messages non lus reçus de chacun
// et la date du dernier échange (les conversations récentes en premier)
export const findContacts = async (userId) => {
  const query = `
    SELECT
      u.id, u.first_name, u.last_name, u.badge_number, u.role, u.grade, u.avatar_url,
      (SELECT COUNT(*) FROM message m
        WHERE m.sender_id = u.id AND m.recipient_id = $1 AND m.read_at IS NULL AND m.deleted_at IS NULL) AS unread,
      (SELECT MAX(m.created_at) FROM message m
        WHERE (m.sender_id = u.id AND m.recipient_id = $1)
           OR (m.sender_id = $1 AND m.recipient_id = u.id)) AS last_message_at
    FROM app_user u
    WHERE u.is_active = true AND u.id <> $1
    ORDER BY last_message_at DESC NULLS LAST, u.last_name, u.first_name
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
};

// Tous les messages non lus de l'agent : privés (d'agents actifs, comme dans la liste
// des contacts) et de ses groupes (écrits par les autres après sa dernière lecture)
export const countUnread = async (userId) => {
  const query = `
    SELECT
      (SELECT COUNT(*) FROM message m JOIN app_user s ON s.id = m.sender_id AND s.is_active
        WHERE m.recipient_id = $1 AND m.read_at IS NULL AND m.deleted_at IS NULL)
      +
      (SELECT COUNT(*) FROM message m
        JOIN message_group_member gm ON gm.group_id = m.group_id AND gm.user_id = $1
        WHERE m.sender_id <> $1 AND m.created_at > gm.last_read_at AND m.deleted_at IS NULL) AS total
  `;
  const result = await pool.query(query, [userId]);
  return Number(result.rows[0]?.total) || 0;
};

// Les derniers messages échangés entre deux agents, du plus ancien au plus récent
export const findConversation = async (userId, otherId, { limit = 200 } = {}) => {
  const query = `
    SELECT * FROM (
      ${SELECT_MESSAGE}
      WHERE (m.sender_id = $1 AND m.recipient_id = $2) OR (m.sender_id = $2 AND m.recipient_id = $1)
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT $3
    ) dernier
    ORDER BY created_at, id
  `;
  const result = await pool.query(query, [userId, otherId, limit]);
  return result.rows;
};

// Marque comme lus les messages reçus de otherId ; renvoie le nombre de messages marqués
export const markRead = async (userId, otherId) => {
  const result = await pool.query(
    'UPDATE message SET read_at = now() WHERE recipient_id = $1 AND sender_id = $2 AND read_at IS NULL',
    [userId, otherId]
  );
  return result.rowCount;
};

// Valeurs SQL d'une pièce jointe facultative : { path, name, type, size, kind }
export const attachmentValues = (attachment) => [
  attachment?.path ?? null, attachment?.name ?? null, attachment?.type ?? null,
  attachment?.size ?? null, attachment?.kind ?? null,
];

export const create = async ({ sender_id, recipient_id, body, attachment = null }) => {
  const query = `
    INSERT INTO message (sender_id, recipient_id, body,
                         attachment_path, attachment_name, attachment_type, attachment_size, attachment_kind)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ${RETURNING_MESSAGE}
  `;
  const result = await pool.query(query, [sender_id, recipient_id, body, ...attachmentValues(attachment)]);
  return result.rows[0];
};

// Événement du fil laissé par le serveur (ex. kind = 'appel-manque-video'), pas un texte de l'agent
export const createEvent = async ({ sender_id, recipient_id, kind, body }) => {
  const result = await pool.query(
    `INSERT INTO message (sender_id, recipient_id, body, kind) VALUES ($1, $2, $3, $4) ${RETURNING_MESSAGE}`,
    [sender_id, recipient_id, body, kind]
  );
  return result.rows[0];
};

// Un message privé ou de groupe, pour savoir qui peut le modifier ou le supprimer
export const findById = async (id) => {
  const result = await pool.query(
    `SELECT id, sender_id, recipient_id, group_id, kind, created_at, deleted_at,
            attachment_path, attachment_name, attachment_type, attachment_kind
     FROM message WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

// Nouveau texte, seulement par l'expéditeur, sur un message pas supprimé et de moins de 15 minutes
// (la condition est dans la requête : pas de course entre la vérification et l'écriture)
export const updateBody = async (id, senderId, body) => {
  const result = await pool.query(
    `UPDATE message SET body = $3, edited_at = now()
     WHERE id = $1 AND sender_id = $2 AND deleted_at IS NULL
       AND created_at > now() - make_interval(mins => $4)
     ${RETURNING_MESSAGE}`,
    [id, senderId, body, EDIT_WINDOW_MINUTES]
  );
  return result.rows[0] || null;
};

// Suppression par l'expéditeur : la ligne reste (ordre du fil), le texte et la pièce jointe sont effacés
export const softDelete = async (id, senderId) => {
  const result = await pool.query(
    `UPDATE message SET body = '', deleted_at = now(),
       attachment_path = NULL, attachment_name = NULL, attachment_type = NULL,
       attachment_size = NULL, attachment_kind = NULL
     WHERE id = $1 AND sender_id = $2 AND deleted_at IS NULL
     ${RETURNING_MESSAGE}`,
    [id, senderId]
  );
  return result.rows[0] || null;
};

// Réaction de l'agent à un message : la même emoji la retire, une autre la remplace.
// Renvoie les réactions à jour du message.
export const setReaction = async (messageId, userId, emoji) => {
  const retiree = await pool.query(
    'DELETE FROM message_reaction WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
    [messageId, userId, emoji]
  );
  if (retiree.rowCount === 0) {
    await pool.query(
      `INSERT INTO message_reaction (message_id, user_id, emoji) VALUES ($1, $2, $3)
       ON CONFLICT (message_id, user_id) DO UPDATE SET emoji = EXCLUDED.emoji, created_at = now()`,
      [messageId, userId, emoji]
    );
  }
  const result = await pool.query(`SELECT ${REACTIONS} FROM message m WHERE m.id = $1`, [messageId]);
  return result.rows[0]?.reactions ?? [];
};
