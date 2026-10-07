-- CrimeTracker — changements de schéma faits après la création de la base
-- schema.sql ne s'applique qu'à une base vide (voir décision 7 de docs/03-conception.md) :
-- ce fichier est exécuté à CHAQUE démarrage de l'API, après schema.sql et avant seed.sql.
-- Chaque instruction doit donc pouvoir être rejouée sans effet (IF NOT EXISTS).

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
