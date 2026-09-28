-- Données d'exemple pour CrimeTracker (développement local uniquement)

BEGIN;

INSERT INTO app_user (first_name, last_name, badge_number, email, password_hash, role, grade, is_active) VALUES
('Massyle', 'Riahi', 'PO-001', 'massyle@crimetracker.local', 'à_remplacer_par_un_hash', 'direction', 'directeur_general', TRUE),
('Eric', 'Tremblay', 'SM-002', 'eric@crimetracker.local', 'à_remplacer_par_un_hash', 'superviseur', 'lieutenant', TRUE),
('Chrysler', 'Jean', 'PL-003', 'chrysler@crimetracker.local', 'à_remplacer_par_un_hash', 'policier', 'sergent_autres_fonctions', TRUE),
('Michael', 'Fortin', 'PL-004', 'michael@crimetracker.local', 'à_remplacer_par_un_hash', 'policier', 'sergent_autres_fonctions', TRUE);

INSERT INTO criminal (first_name, last_name, date_of_birth, nationality, status, description, crimes, added_by) VALUES
('Jean', 'Dupont', '1985-04-12', 'Canadienne', 'recherche', 'Vu pour la dernière fois à Montréal.', 'Vol qualifié', 3);

INSERT INTO sighting (criminal_id, reported_by, location, notes) VALUES
(1, 4, 'Métro Berri-UQAM', 'Individu correspondant au signalement, non intercepté.');

INSERT INTO alert (issued_by, criminal_id, message, severity) VALUES
(2, 1, 'Individu potentiellement armé, prudence recommandée.', 'urgent');

COMMIT;
