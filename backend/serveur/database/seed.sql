-- Données de démonstration pour CrimeTracker (fictives).
-- Chargées automatiquement au premier démarrage, si la table app_user est vide.
-- Mot de passe de TOUS les comptes : Demo1234!  (haché avec bcrypt, coût 10)

BEGIN;

INSERT INTO app_user (first_name, last_name, badge_number, email, password_hash, role, grade, is_active) VALUES
('Massyle', 'Riahi', 'PO-001', 'massyle@crimetracker.local', '$2a$10$xhThZvFeRT11.T179IV8w.gZLQN341nBhcIcUErwc00EOoq11OMBW', 'direction', 'directeur_general', TRUE),
('Eric', 'Tremblay', 'SM-002', 'eric@crimetracker.local', '$2a$10$xhThZvFeRT11.T179IV8w.gZLQN341nBhcIcUErwc00EOoq11OMBW', 'superviseur', 'lieutenant', TRUE),
('Chrysler', 'Jean', 'PL-003', 'chrysler@crimetracker.local', '$2a$10$xhThZvFeRT11.T179IV8w.gZLQN341nBhcIcUErwc00EOoq11OMBW', 'policier', 'sergent_autres_fonctions', TRUE),
('Michael', 'Fortin', 'PL-004', 'michael@crimetracker.local', '$2a$10$xhThZvFeRT11.T179IV8w.gZLQN341nBhcIcUErwc00EOoq11OMBW', 'policier', 'sergent_autres_fonctions', TRUE),
('Compte', 'Désactivé', 'PL-005', 'inactif@crimetracker.local', '$2a$10$xhThZvFeRT11.T179IV8w.gZLQN341nBhcIcUErwc00EOoq11OMBW', 'policier', 'sergent_autres_fonctions', FALSE);

INSERT INTO criminal (first_name, last_name, date_of_birth, nationality, status, description, crimes, added_by) VALUES
('Jean', 'Dupont', '1985-04-12', 'Canadienne', 'recherche', 'Vu pour la dernière fois à Montréal.', 'Vol qualifié', 3),
('Luc', 'Gagnon', '1979-11-02', 'Canadienne', 'recherche', 'Cicatrice à la joue gauche, 1,80 m.', 'Fraude, faux et usage de faux', 3),
('Sofia', 'Moreau', '1990-06-21', 'Française', 'capture', 'Arrêtée à Laval.', 'Trafic de stupéfiants', 4),
('Karim', 'Benali', '1988-01-15', 'Canadienne', 'recherche', 'Circule en berline grise.', 'Vol de véhicules', 4),
('Anna', 'Kowalski', '1995-09-30', 'Polonaise', 'libere', 'Libérée sous conditions.', 'Recel', 2),
('Marc', 'Lefebvre', '1972-03-08', 'Canadienne', 'recherche', 'Tatouage sur l''avant-bras droit.', 'Agression armée', 2),
('Julie', 'Roy', '1983-12-19', 'Canadienne', 'recherche', 'Aperçue près du port de Montréal.', 'Extorsion', 3),
('Pierre', 'Bouchard', '1969-07-04', 'Canadienne', 'capture', 'Arrêté à Québec.', 'Incendie criminel', 4),
('Nadia', 'Haddad', '1992-02-11', 'Libanaise', 'recherche', 'Parle français, arabe et anglais.', 'Fraude informatique', 3),
('Olivier', 'Côté', '1987-10-27', 'Canadienne', 'recherche', 'Porte souvent une casquette rouge.', 'Cambriolages', 4),
('Emma', 'Lavoie', '1998-05-14', 'Canadienne', 'recherche', 'Dernière adresse connue : Longueuil.', 'Vol à l''étalage en bande organisée', 2),
('Thomas', 'Girard', '1980-08-09', 'Belge', 'recherche', 'Voyage fréquemment entre Montréal et Ottawa.', 'Blanchiment d''argent', 2);

-- Chaque dossier démarre avec une entrée d'historique : son statut initial.
INSERT INTO criminal_status_history (criminal_id, status, changed_by)
SELECT id, status, added_by FROM criminal;

INSERT INTO sighting (criminal_id, reported_by, location, notes) VALUES
(1, 4, 'Métro Berri-UQAM', 'Individu correspondant au signalement, non intercepté.');

INSERT INTO alert (issued_by, criminal_id, message, severity) VALUES
(2, 1, 'Individu potentiellement armé, prudence recommandée.', 'urgent');

COMMIT;
