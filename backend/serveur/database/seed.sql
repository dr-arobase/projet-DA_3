-- Données d'exemple pour CrimeTracker (développement local uniquement)

-- Comptes de démonstration : mot de passe Alpha2026! pour les quatre (hachés avec bcrypt).
-- Base déjà créée avant ce seed : dans backend/, « node scripts/set-passwords.js Alpha2026! » (change TOUS les comptes)

BEGIN;

INSERT INTO app_user (first_name, last_name, badge_number, email, password_hash, role, grade, is_active) VALUES
('Massyle', 'Riahi', 'PO-001', 'massyle@crimetracker.local', '$2b$10$gHgpwBZLlwU.Yp9la99Yq.IuQe8Qem1gpmL0O0Nx3l63LKlMmB9My', 'direction', 'directeur_general', TRUE),
('Eric', 'Tremblay', 'SM-002', 'eric@crimetracker.local', '$2b$10$liR7N8ajiKJhZNvTiJ4HTO3js7qbHA.k1k8FIO28Yqq4BnWI9zddK', 'superviseur', 'lieutenant', TRUE),
('Chrysler', 'Jean', 'PL-003', 'chrysler@crimetracker.local', '$2b$10$OPpruVveRQFjAfUWuDEuiulW6k0OKbpj2Twbssl4pDG29GJBUtd/.', 'policier', 'sergent_autres_fonctions', TRUE),
('Michael', 'Fortin', 'PL-004', 'michael@crimetracker.local', '$2b$10$/az/MuS61hFoKSqiIFN4nubotzkhuIbG.YrxlZQmLYPL2XIfjPu1e', 'policier', 'sergent_autres_fonctions', TRUE),
-- Compte rapide de l'équipe pour les tests en local : matricule 1, mot de passe 2
('Test', 'Équipe', '1', 'equipe@crimetracker.local', '$2b$10$MbLJKBM6lydf2i9hrN8J/.6JUoz3Vexbkv2RV07kvi69KKFi40e.a', 'direction', 'directeur_general', TRUE);

INSERT INTO criminal (first_name, last_name, date_of_birth, nationality, status, description, crimes, added_by) VALUES
('Jean', 'Dupont', '1985-04-12', 'Canadienne', 'recherche', 'Vu pour la dernière fois à Montréal.', 'Vol qualifié', 3);

INSERT INTO sighting (criminal_id, reported_by, location, notes, latitude, longitude) VALUES
(1, 4, 'Métro Berri-UQAM', 'Individu correspondant au signalement, non intercepté.', 45.5153, -73.5610);

INSERT INTO alert (issued_by, criminal_id, message, severity) VALUES
(2, 1, 'Individu potentiellement armé, prudence recommandée.', 'urgent');

COMMIT;
