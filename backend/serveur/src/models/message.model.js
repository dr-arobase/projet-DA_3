import { pool } from '../config/db.js';

const SELECT_MESSAGE = `
  SELECT m.id, m.sender_id, m.recipient_id, m.body, m.created_at, m.read_at, m.edited_at, m.deleted_at
  FROM message m
`;

// Champs renvoyés après une modification ou une suppression (message privé ou de groupe)
const RETURNING_MESSAGE = 'RETURNING id, sender_id, recipient_id, group_id, body, created_at, read_at, edited_at, deleted_at';

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

export const create = async ({ sender_id, recipient_id, body }) => {
  const query = `
    INSERT INTO message (sender_id, recipient_id, body)
    VALUES ($1, $2, $3)
    RETURNING id, sender_id, recipient_id, body, created_at, read_at, edited_at, deleted_at
  `;
  const result = await pool.query(query, [sender_id, recipient_id, body]);
  return result.rows[0];
};

// Un message privé ou de groupe, pour savoir qui peut le modifier ou le supprimer
export const findById = async (id) => {
  const result = await pool.query(
    'SELECT id, sender_id, recipient_id, group_id, created_at, deleted_at FROM message WHERE id = $1',
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

// Suppression par l'expéditeur : la ligne reste (ordre du fil), le texte est effacé
export const softDelete = async (id, senderId) => {
  const result = await pool.query(
    `UPDATE message SET body = '', deleted_at = now()
     WHERE id = $1 AND sender_id = $2 AND deleted_at IS NULL
     ${RETURNING_MESSAGE}`,
    [id, senderId]
  );
  return result.rows[0] || null;
};
