-- CrimeTracker — changements de schéma faits après la création de la base
-- schema.sql ne s'applique qu'à une base vide (voir décision 7 de docs/03-conception.md) :
-- ce fichier est exécuté à CHAQUE démarrage de l'API, après schema.sql et avant seed.sql.
-- Chaque instruction doit donc pouvoir être rejouée sans effet (IF NOT EXISTS).

-- Toujours lire ce fichier en UTF-8, même lancé par psql depuis une console Windows (#62)
SET client_encoding = 'UTF8';

-- Photo de profil (page « Mon profil »)
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);

-- Position d'un signalement, pour la carte (#21). Facultative : un signalement peut n'avoir qu'un lieu écrit.
ALTER TABLE sighting ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE sighting ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Messagerie privée entre agents
CREATE TABLE IF NOT EXISTS message (
    id              SERIAL PRIMARY KEY,
    sender_id       INTEGER NOT NULL REFERENCES app_user(id),
    recipient_id    INTEGER NOT NULL REFERENCES app_user(id),
    body            VARCHAR(2000) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at         TIMESTAMPTZ,
    CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_message_sender_recipient ON message(sender_id, recipient_id, created_at);
CREATE INDEX IF NOT EXISTS idx_message_unread ON message(recipient_id) WHERE read_at IS NULL;

-- Connexion GitHub (OAuth 2) : le compte GitHub lié, et plus de mot de passe obligatoire
-- (un compte créé par GitHub n'en a pas; il ne peut pas se connecter par matricule)
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS github_id BIGINT UNIQUE;
ALTER TABLE app_user ALTER COLUMN password_hash DROP NOT NULL;

-- Dernière adresse connue d'un dossier (#64), convertie en position par le serveur pour la carte.
-- La position est facultative : une adresse introuvable est gardée telle quelle, sans position.
ALTER TABLE criminal ADD COLUMN IF NOT EXISTS last_known_address VARCHAR(255);
ALTER TABLE criminal ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE criminal ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Accents perdus (#62) : les données de départ de certaines bases ont été insérées par un
-- outil qui ne lisait pas seed.sql en UTF-8 (« armé » devenu « arm?? »). On remet le texte
-- d'origine de seed.sql, seulement là où il est abîmé : sans effet sur une base saine.
UPDATE criminal SET description = 'Vu pour la dernière fois à Montréal.', crimes = 'Vol qualifié'
  WHERE first_name = 'Jean' AND last_name = 'Dupont' AND (description LIKE '%??%' OR crimes LIKE '%??%');
UPDATE alert SET message = 'Individu potentiellement armé, prudence recommandée.'
  WHERE message LIKE 'Individu potentiellement arm??%';
UPDATE sighting SET location = 'Métro Berri-UQAM', notes = 'Individu correspondant au signalement, non intercepté.'
  WHERE location LIKE 'M??tro Berri-UQAM%';

-- Groupes de discussion (#55) : un message va soit à un agent (recipient_id), soit à un groupe (group_id)
CREATE TABLE IF NOT EXISTS message_group (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    created_by      INTEGER NOT NULL REFERENCES app_user(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- last_read_at : les messages du groupe arrivés après sont « non lus » pour ce membre
CREATE TABLE IF NOT EXISTS message_group_member (
    group_id        INTEGER NOT NULL REFERENCES message_group(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES app_user(id),
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_read_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, user_id)
);

ALTER TABLE message ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES message_group(id) ON DELETE CASCADE;
ALTER TABLE message ALTER COLUMN recipient_id DROP NOT NULL;
ALTER TABLE message DROP CONSTRAINT IF EXISTS message_destination;
ALTER TABLE message ADD CONSTRAINT message_destination CHECK ((recipient_id IS NULL) <> (group_id IS NULL));

CREATE INDEX IF NOT EXISTS idx_message_group ON message(group_id, created_at);
CREATE INDEX IF NOT EXISTS idx_message_group_member_user ON message_group_member(user_id);

-- Limitation partagée des tentatives de connexion par adresse IP (clé HMAC, fenêtre de 15 min)
CREATE TABLE IF NOT EXISTS login_rate_limit (
    client_key       CHAR(64) PRIMARY KEY,
    window_start     BIGINT NOT NULL,
    failed_attempts  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_rate_limit_window ON login_rate_limit(window_start);
-- Modifier un message pendant 15 minutes (#143) et le supprimer (#144).
-- Un message supprimé garde sa ligne (le fil reste dans l'ordre) mais perd son texte.
ALTER TABLE message ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE message ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Pièces jointes (#57) et messages vocaux (#59) : le fichier est sur le disque de l'API
-- (dossier uploads/messages, nom tiré au hasard) ; la base garde son nom affiché, son type et sa taille.
ALTER TABLE message ADD COLUMN IF NOT EXISTS attachment_path VARCHAR(100);
ALTER TABLE message ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255);
ALTER TABLE message ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(50);
ALTER TABLE message ADD COLUMN IF NOT EXISTS attachment_size INTEGER;
ALTER TABLE message ADD COLUMN IF NOT EXISTS attachment_kind VARCHAR(10); -- 'image', 'audio' ou 'file'

-- Réactions aux messages (emoji) : une par agent et par message, comme dans Messenger.
-- Toucher un autre emoji remplace la réaction ; retoucher le même la retire.
CREATE TABLE IF NOT EXISTS message_reaction (
  message_id INTEGER NOT NULL REFERENCES message(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  emoji      VARCHAR(16) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

-- Messages-événements (pas écrits par l'agent) : 'appel-manque-audio' ou 'appel-manque-video'.
-- Ils s'affichent comme un événement du fil ; on peut les supprimer, pas les modifier.
ALTER TABLE message ADD COLUMN IF NOT EXISTS kind VARCHAR(30);
-- Appels manqués créés avant la colonne kind (texte avec une emoji) : on les convertit.
UPDATE message SET kind = 'appel-manque-audio', body = 'Appel audio manqué' WHERE kind IS NULL AND body = '📞 Appel audio manqué';
UPDATE message SET kind = 'appel-manque-video', body = 'Appel vidéo manqué' WHERE kind IS NULL AND body = '📞 Appel vidéo manqué';
