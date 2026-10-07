import { pool } from '../config/db.js';

const SELECT_MESSAGE = `
  SELECT m.id, m.sender_id, m.recipient_id, m.body, m.created_at, m.read_at
  FROM message m
`;

// Agents actifs à qui écrire, avec le nombre de messages non lus reçus de chacun
// et la date du dernier échange (les conversations récentes en premier)
export const findContacts = async (userId) => {
  const query = `
    SELECT
      u.id, u.first_name, u.last_name, u.badge_number, u.role, u.grade, u.avatar_url,
      (SELECT COUNT(*) FROM message m
        WHERE m.sender_id = u.id AND m.recipient_id = $1 AND m.read_at IS NULL) AS unread,
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
    RETURNING id, sender_id, recipient_id, body, created_at, read_at
  `;
  const result = await pool.query(query, [sender_id, recipient_id, body]);
  return result.rows[0];
};
