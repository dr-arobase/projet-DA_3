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

-- Accents perdus (#62) : les données de départ de certaines bases ont été insérées par un
-- outil qui ne lisait pas seed.sql en UTF-8 (« armé » devenu « arm?? »). On remet le texte
-- d'origine de seed.sql, seulement là où il est abîmé : sans effet sur une base saine.
UPDATE criminal SET description = 'Vu pour la dernière fois à Montréal.', crimes = 'Vol qualifié'
  WHERE first_name = 'Jean' AND last_name = 'Dupont' AND (description LIKE '%??%' OR crimes LIKE '%??%');
UPDATE alert SET message = 'Individu potentiellement armé, prudence recommandée.'
  WHERE message LIKE 'Individu potentiellement arm??%';
UPDATE sighting SET location = 'Métro Berri-UQAM', notes = 'Individu correspondant au signalement, non intercepté.'
  WHERE location LIKE 'M??tro Berri-UQAM%';
