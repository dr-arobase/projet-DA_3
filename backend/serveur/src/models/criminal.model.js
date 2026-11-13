import { pool } from '../config/db.js';

// Les noms de l'agent qui a créé / modifié le dossier remplacent leurs id
const SELECT_WITH_NAMES = `
  SELECT
    c.id, c.first_name, c.last_name, c.date_of_birth, c.nationality,
    c.photo_url, c.status, c.description, c.crimes, c.version,
    c.last_known_address, c.latitude, c.longitude,
    c.added_at, c.updated_at,
    (au.first_name || ' ' || au.last_name) AS added_by,
    (uu.first_name || ' ' || uu.last_name) AS updated_by
  FROM criminal c
  LEFT JOIN app_user au ON c.added_by = au.id
  LEFT JOIN app_user uu ON c.updated_by = uu.id
`;

// Filtres communs à la liste et au comptage : statut exact, et recherche par nom
// (prénom nom ou nom prénom, sans tenir compte des majuscules)
function buildFilters({ status, search } = {}) {
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`c.status = $${params.length}`);
  }
  if (search) {
    // % et _ tapés par l'agent sont cherchés tels quels, pas comme des jokers
    params.push(`%${search.replace(/[\\%_]/g, '\\$&')}%`);
    const n = params.length;
    conditions.push(`((c.first_name || ' ' || c.last_name) ILIKE $${n} OR (c.last_name || ' ' || c.first_name) ILIKE $${n})`);
  }

  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

// Récupérer les criminels avec pagination, filtre optionnel sur le statut et recherche par nom
export const findAll = async ({ limit = 10, offset = 0, status, search } = {}) => {
  const { where, params } = buildFilters({ status, search });
  const query = `${SELECT_WITH_NAMES}${where} ORDER BY c.added_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

  const result = await pool.query(query, [...params, limit, offset]);
  return result.rows;
};

// Compter les criminels (pour le nombre total de pages), avec les mêmes filtres
export const countAll = async ({ status, search } = {}) => {
  const { where, params } = buildFilters({ status, search });
  const result = await pool.query(`SELECT COUNT(*) FROM criminal c${where}`, params);
  return parseInt(result.rows[0].count, 10);
};

export const findById = async (id) => {
  const result = await pool.query(`${SELECT_WITH_NAMES} WHERE c.id = $1`, [id]);
  return result.rows[0] || null;
};

export const create = async ({
  first_name, last_name, date_of_birth, nationality,
  description, crimes, status, photo_url, added_by,
  last_known_address, latitude, longitude
}) => {
  const query = `
    INSERT INTO criminal
      (first_name, last_name, date_of_birth, nationality, description, crimes, status, photo_url, added_by,
       last_known_address, latitude, longitude)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
  `;
  const values = [
    first_name, last_name, date_of_birth || null, nationality || null,
    description || null, crimes || null, status || 'recherche',
    photo_url || null, added_by,
    last_known_address || null, latitude ?? null, longitude ?? null
  ];
  const result = await pool.query(query, values);
  return result.rows[0];
};

// Mettre à jour les informations d'un dossier (sans changer le statut), avec verrouillage
// optimiste (#98) : rien n'est écrit si la version en base n'est plus celle que le client a lue.
// effacer_photo retire la photo; sinon elle est gardée telle quelle.
// Retourne null si le dossier n'existe pas ou si la version ne correspond plus.
// Colonnes qu'une modification complète peut changer (liste fixe : jamais un nom venu de la requête)
const COLONNES_MODIFIABLES = ['first_name', 'last_name', 'date_of_birth', 'nationality', 'description', 'crimes'];

// Modifier un dossier (#98, #187). « changes » ne contient que les champs envoyés par le client :
// un champ absent n'est pas touché (avant, il était remis à NULL); un champ envoyé vide est effacé.
// La version attendue protège contre l'écrasement par un autre agent (verrouillage optimiste).
export const update = async (id, { changes, effacer_photo, updated_by }, expectedVersion) => {
  const values = [];
  const sets = [];
  for (const colonne of COLONNES_MODIFIABLES) {
    if (Object.hasOwn(changes, colonne)) {
      values.push(changes[colonne] ?? null);
      sets.push(`${colonne} = $${values.length}`);
    }
  }
  values.push(Boolean(effacer_photo));
  sets.push(`photo_url = CASE WHEN $${values.length} THEN NULL ELSE photo_url END`);
  values.push(updated_by);
  sets.push(`updated_by = $${values.length}`);
  values.push(id);
  const idParam = values.length;
  values.push(expectedVersion);
  const versionParam = values.length;

  const query = `
    WITH before AS (SELECT status AS previous_status FROM criminal WHERE id = $${idParam})
    UPDATE criminal
    SET ${sets.join(',\n        ')}
    WHERE id = $${idParam} AND version = $${versionParam}
    RETURNING criminal.*, (SELECT previous_status FROM before) AS previous_status
  `;
  const result = await pool.query(query, values);
  return result.rows[0] || null;
};

// Changer le statut avec verrouillage optimiste : la mise à jour n'a lieu que si
// la version envoyée est encore la version en base (le trigger l'incrémente ensuite).
// Retourne null si le dossier n'existe pas ou si la version ne correspond plus.
export const updateStatus = async (id, status, expectedVersion, updated_by) => {
  const query = `
    WITH before AS (SELECT status AS previous_status FROM criminal WHERE id = $3)
    UPDATE criminal
    SET status = $1,
        updated_by = $2
    WHERE id = $3 AND version = $4
    RETURNING criminal.*, (SELECT previous_status FROM before) AS previous_status
  `;
  const result = await pool.query(query, [status, updated_by, id, expectedVersion]);
  return result.rows[0] || null;
};

// Dernière adresse connue et sa position (null si introuvable, ou pour effacer l'adresse)
export const setAddress = async (id, { last_known_address, latitude, longitude, updated_by }) => {
  const result = await pool.query(
    `WITH before AS (SELECT status AS previous_status FROM criminal WHERE id = $5)
     UPDATE criminal
     SET last_known_address = $1, latitude = $2, longitude = $3, updated_by = $4
     WHERE id = $5
     RETURNING criminal.id, (SELECT previous_status FROM before) AS previous_status`,
    [last_known_address || null, latitude ?? null, longitude ?? null, updated_by, id]
  );
  return result.rows[0] || null;
};

// Photo du dossier : chemin de l'image, ou null pour l'effacer
export const setPhoto = async (id, photo_url, updated_by) => {
  const result = await pool.query(
    'UPDATE criminal SET photo_url = $1, updated_by = $2 WHERE id = $3 RETURNING id',
    [photo_url, updated_by, id]
  );
  return result.rows[0] || null;
};

export const remove = async (id) => {
  const result = await pool.query('DELETE FROM criminal WHERE id = $1 RETURNING id, status', [id]);
  return result.rows[0] || null;
};
