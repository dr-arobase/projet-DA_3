-- CrimeTracker — schéma PostgreSQL initial
-- Basé sur le modèle de données de docs/03-conception.md
-- Verrouillage optimiste sur CRIMINAL via la colonne "version" (Décision 2)

BEGIN;

-- ============================================================
-- Types énumérés
-- ============================================================

CREATE TYPE user_role AS ENUM ('policier', 'superviseur', 'direction');

CREATE TYPE user_grade AS ENUM (
    'sergent_autres_fonctions',
    'sergent_gestionnaire',
    'sergent_responsable_de_poste',
    'lieutenant',
    'capitaine',
    'inspecteur',
    'inspecteur_chef',
    'directeur_general_adjoint',
    'directeur_general'
);

CREATE TYPE criminal_status AS ENUM ('recherche', 'capture', 'libere');

CREATE TYPE alert_severity AS ENUM ('info', 'urgent');

-- ============================================================
-- USER — comptes policiers, superviseurs, direction
-- ============================================================

CREATE TABLE app_user (
    id              SERIAL PRIMARY KEY,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    badge_number    VARCHAR(20) NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            user_role NOT NULL DEFAULT 'policier',
    grade           user_grade NOT NULL DEFAULT 'sergent_autres_fonctions',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CRIMINAL — dossiers de personnes recherchées
-- ============================================================

CREATE TABLE criminal (
    id              SERIAL PRIMARY KEY,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    date_of_birth   DATE,
    nationality     VARCHAR(100),
    photo_url       VARCHAR(500),
    status          criminal_status NOT NULL DEFAULT 'recherche',
    description     TEXT,
    crimes          TEXT,
    added_by        INTEGER NOT NULL REFERENCES app_user(id),
    updated_by      INTEGER REFERENCES app_user(id),
    version         INTEGER NOT NULL DEFAULT 1,
    added_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SIGHTING — signalements d'observation sur le terrain
-- ============================================================

CREATE TABLE sighting (
    id              SERIAL PRIMARY KEY,
    criminal_id     INTEGER NOT NULL REFERENCES criminal(id) ON DELETE CASCADE,
    reported_by     INTEGER NOT NULL REFERENCES app_user(id),
    location        VARCHAR(255) NOT NULL,
    notes           TEXT,
    reported_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ALERT — alertes et communiqués diffusés en temps réel
-- ============================================================

CREATE TABLE alert (
    id              SERIAL PRIMARY KEY,
    issued_by       INTEGER NOT NULL REFERENCES app_user(id),
    criminal_id     INTEGER REFERENCES criminal(id) ON DELETE SET NULL,
    message         VARCHAR(500) NOT NULL,
    severity        alert_severity NOT NULL DEFAULT 'info',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- AUDIT_LOG — journal des actions sensibles
-- ============================================================

CREATE TABLE audit_log (
    id              SERIAL PRIMARY KEY,
    actor_id        INTEGER NOT NULL REFERENCES app_user(id),
    action          VARCHAR(100) NOT NULL,
    target_type     VARCHAR(50) NOT NULL,
    target_id       INTEGER NOT NULL,
    details         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Index utiles
-- ============================================================

CREATE INDEX idx_criminal_status ON criminal(status);
CREATE INDEX idx_criminal_last_name ON criminal(last_name);
CREATE INDEX idx_sighting_criminal_id ON sighting(criminal_id);
CREATE INDEX idx_alert_criminal_id ON alert(criminal_id);
CREATE INDEX idx_audit_log_actor_id ON audit_log(actor_id);

-- ============================================================
-- Trigger : incrémente "version" et "updated_at" à chaque mise à jour
-- (verrouillage optimiste — Décision 2 de docs/03-conception.md)
-- ============================================================

CREATE OR REPLACE FUNCTION bump_criminal_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.version := OLD.version + 1;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bump_criminal_version
    BEFORE UPDATE ON criminal
    FOR EACH ROW
    EXECUTE FUNCTION bump_criminal_version();

COMMIT;
