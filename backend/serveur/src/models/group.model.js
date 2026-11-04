import { pool } from '../config/db.js';
import { attachmentValues, REACTIONS } from './message.model.js';

// Groupes de discussion de la messagerie (#55). Les fonctions qui écrivent reçoivent
// le client d'une transaction (withTransaction), ou utilisent le pool par défaut.

// Membres d'un groupe, en JSON : [{ id, first_name, last_name, badge_number }]
const MEMBERS = `
  (SELECT COALESCE(json_agg(json_build_object(
      'id', u.id, 'first_name', u.first_name, 'last_name', u.last_name, 'badge_number', u.badge_number
    ) ORDER BY u.last_name, u.first_name), '[]')
   FROM message_group_member x JOIN app_user u ON u.id = x.user_id
   WHERE x.group_id = g.id) AS members
`;

// Message de groupe, avec le nom de l'expéditeur (plusieurs personnes écrivent dans le fil)
const SELECT_GROUP_MESSAGE = `
  SELECT m.id, m.sender_id, m.group_id, m.body, m.created_at, m.edited_at, m.deleted_at,
         m.attachment_name, m.attachment_type, m.attachment_size, m.attachment_kind, m.kind,
         u.first_name AS sender_first_name, u.last_name AS sender_last_name, u.badge_number AS sender_badge_number,
         ${REACTIONS}
  FROM message m JOIN app_user u ON u.id = m.sender_id
`;

// Les groupes de l'agent, avec les membres, les non-lus et la date du dernier message
export const findForUser = async (userId) => {
  const query = `
    SELECT * FROM (
      SELECT g.id, g.name, g.created_by, g.created_at, ${MEMBERS},
        (SELECT COUNT(*) FROM message m
          WHERE m.group_id = g.id AND m.sender_id <> $1 AND m.created_at > gm.last_read_at
            AND m.deleted_at IS NULL) AS unread,
        (SELECT MAX(m.created_at) FROM message m WHERE m.group_id = g.id) AS last_message_at
      FROM message_group g
      JOIN message_group_member gm ON gm.group_id = g.id AND gm.user_id = $1
    ) groupes
    ORDER BY COALESCE(last_message_at, created_at) DESC
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
};

export const findById = async (groupId, db = pool) => {
  const result = await db.query(
    `SELECT g.id, g.name, g.created_by, g.created_at, ${MEMBERS} FROM message_group g WHERE g.id = $1`,
    [groupId]
  );
  return result.rows[0] || null;
};

export const isMember = async (groupId, userId) => {
  const result = await pool.query(
    'SELECT 1 FROM message_group_member WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  );
  return result.rows.length > 0;
};

export const create = async ({ name, created_by }, db = pool) => {
  const result = await db.query(
    'INSERT INTO message_group (name, created_by) VALUES ($1, $2) RETURNING id',
    [name, created_by]
  );
  return result.rows[0].id;
};

// Ajoute des membres; ceux qui y sont déjà sont ignorés. Renvoie les ids réellement ajoutés.
export const addMembers = async (groupId, userIds, db = pool) => {
  const result = await db.query(
    `INSERT INTO message_group_member (group_id, user_id)
     SELECT $1, unnest($2::int[])
     ON CONFLICT DO NOTHING
     RETURNING user_id`,
    [groupId, userIds]
  );
  return result.rows.map((r) => r.user_id);
};

export const removeMember = async (groupId, userId, db = pool) => {
  const result = await db.query(
    'DELETE FROM message_group_member WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  );
  return result.rowCount;
};

// Le créateur est parti : le membre le plus ancien gère le groupe. Sans membre, le groupe disparaît.
// Renvoie le nouveau gestionnaire, ou null si le groupe a été supprimé.
export const transferOrDelete = async (groupId, db = pool) => {
  const result = await db.query(
    `UPDATE message_group SET created_by = (
       SELECT user_id FROM message_group_member WHERE group_id = $1 ORDER BY joined_at, user_id LIMIT 1
     )
     WHERE id = $1 AND EXISTS (SELECT 1 FROM message_group_member WHERE group_id = $1)
     RETURNING created_by`,
    [groupId]
  );
  if (result.rows.length > 0) return result.rows[0].created_by;
  await db.query('DELETE FROM message_group WHERE id = $1', [groupId]);
  return null;
};

// Les derniers messages du groupe, du plus ancien au plus récent
export const findMessages = async (groupId, { limit = 200 } = {}) => {
  const query = `
    SELECT * FROM (
      ${SELECT_GROUP_MESSAGE}
      WHERE m.group_id = $1
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT $2
    ) dernier
    ORDER BY created_at, id
  `;
  const result = await pool.query(query, [groupId, limit]);
  return result.rows;
};

export const markRead = async (groupId, userId) => {
  await pool.query(
    'UPDATE message_group_member SET last_read_at = now() WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  );
};

// attachment (facultatif) : { path, name, type, size, kind }, comme pour un message privé
export const createMessage = async ({ sender_id, group_id, body, attachment = null }) => {
  const result = await pool.query(
    `WITH cree AS (
       INSERT INTO message (sender_id, group_id, body,
                            attachment_path, attachment_name, attachment_type, attachment_size, attachment_kind)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, sender_id, group_id, body, created_at, edited_at, deleted_at,
                 attachment_name, attachment_type, attachment_size, attachment_kind
     )
     SELECT cree.*, u.first_name AS sender_first_name, u.last_name AS sender_last_name,
            u.badge_number AS sender_badge_number
     FROM cree JOIN app_user u ON u.id = cree.sender_id`,
    [sender_id, group_id, body, ...attachmentValues(attachment)]
  );
  return result.rows[0];
};

// Ids parmi userIds qui sont des comptes actifs
export const findActiveUserIds = async (userIds) => {
  const result = await pool.query(
    'SELECT id FROM app_user WHERE id = ANY($1::int[]) AND is_active = true',
    [userIds]
  );
  return result.rows.map((r) => r.id);
};
