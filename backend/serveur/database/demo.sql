-- Données de démonstration crédibles pour le site en ligne (#209).
-- 13 dossiers fictifs (noms inventés), leurs signalements sur plusieurs jours dans plusieurs
-- quartiers de Montréal, des alertes urgentes et des communiqués, chacun à sa place.
--
-- Le script n'efface rien et peut être relancé : un dossier déjà présent (même prénom et même nom)
-- est sauté avec ses signalements et ses diffusions. Les dates sont relatives au moment du
-- chargement, pour que la démonstration paraisse récente.
--
-- Charger sur le serveur (dossier deploy/) :
--   docker compose exec -T postgres psql -U crimetracker -d crimetracker < demo.sql
--
-- Les agents viennent des comptes existants : superviseur SM-002, policiers PL-003 et PL-004,
-- direction PO-001. S'il en manque un, le premier compte de direction actif le remplace.

DO $$
DECLARE
  dir INT; sup INT; pol1 INT; pol2 INT; c INT;
BEGIN
  SELECT id INTO dir FROM app_user WHERE role = 'direction' AND is_active ORDER BY id LIMIT 1;
  IF dir IS NULL THEN
    RAISE EXCEPTION 'Aucun compte de direction actif : créez les comptes avant de charger la démonstration.';
  END IF;
  SELECT COALESCE((SELECT id FROM app_user WHERE badge_number = 'PO-001'), dir) INTO dir;
  SELECT COALESCE((SELECT id FROM app_user WHERE badge_number = 'SM-002'), dir) INTO sup;
  SELECT COALESCE((SELECT id FROM app_user WHERE badge_number = 'PL-003'), sup) INTO pol1;
  SELECT COALESCE((SELECT id FROM app_user WHERE badge_number = 'PL-004'), sup) INTO pol2;

  -- 1. Recherché, signalé trois fois cette semaine
  IF NOT EXISTS (SELECT 1 FROM criminal WHERE first_name = 'Kevin' AND last_name = 'Ostiguy') THEN
    INSERT INTO criminal (first_name, last_name, date_of_birth, nationality, status, description, crimes, added_by, last_known_address, latitude, longitude, added_at, updated_at)
    VALUES ('Kevin', 'Ostiguy', '1991-03-08', 'Canadienne', 'recherche',
      'Environ 1,80 m, cheveux bruns courts, tatouage d''ancre sur l''avant-bras gauche. Se déplace souvent en métro.',
      'Vols de véhicules en série', sup, '4520, rue Ontario Est, Montréal', 45.5476, -73.5395, now() - interval '12 days', now() - interval '12 days')
    RETURNING id INTO c;
    INSERT INTO sighting (criminal_id, reported_by, location, notes, reported_at, latitude, longitude) VALUES
      (c, pol1, 'Station Berri-UQAM, sortie Saint-Denis', 'Montait dans un taxi vers le nord.', now() - interval '5 days 3 hours', 45.5153, -73.5610),
      (c, pol2, 'Rue Ontario Est, près du boulevard Pie-IX', 'Tournait autour des voitures stationnées.', now() - interval '3 days 6 hours', 45.5521, -73.5420),
      (c, pol1, 'Stade olympique, stationnement P5', 'Seul, casquette noire.', now() - interval '1 day 2 hours', 45.5579, -73.5516);
    INSERT INTO alert (issued_by, criminal_id, message, severity, created_at) VALUES
      (sup, c, 'Kevin Ostiguy aperçu au stationnement du Stade olympique il y a une heure. Il cherche un véhicule à voler. Ne pas intervenir seul : prévenir un superviseur.', 'urgent', now() - interval '1 day 1 hour');
  END IF;

  -- 2. Recherchée pour fraude
  IF NOT EXISTS (SELECT 1 FROM criminal WHERE first_name = 'Sabrina' AND last_name = 'Lanthier') THEN
    INSERT INTO criminal (first_name, last_name, date_of_birth, nationality, status, description, crimes, added_by, last_known_address, latitude, longitude, added_at, updated_at)
    VALUES ('Sabrina', 'Lanthier', '1988-11-22', 'Canadienne', 'recherche',
      'Environ 1,65 m, cheveux blonds mi-longs. Utilise plusieurs noms.',
      'Fraude par carte de crédit', dir, '1100, avenue Laurier Ouest, Montréal', 45.5225, -73.6020, now() - interval '20 days', now() - interval '20 days')
    RETURNING id INTO c;
    INSERT INTO sighting (criminal_id, reported_by, location, notes, reported_at, latitude, longitude) VALUES
      (c, pol2, 'Carrefour Angrignon, entrée principale', 'Achats avec une carte au nom d''une autre personne.', now() - interval '8 days', 45.4467, -73.6026),
      (c, pol1, 'Marché Jean-Talon', 'Reconnue par une commerçante.', now() - interval '2 days 4 hours', 45.5363, -73.6145);
  END IF;

  -- 3. Capturé, avec le communiqué de l'arrestation
  IF NOT EXISTS (SELECT 1 FROM criminal WHERE first_name = 'Marc-André' AND last_name = 'Bouffard') THEN
    INSERT INTO criminal (first_name, last_name, date_of_birth, nationality, status, description, crimes, added_by, last_known_address, latitude, longitude, added_at, updated_at)
    VALUES ('Marc-André', 'Bouffard', '1979-06-30', 'Canadienne', 'capture',
      'Environ 1,75 m, barbe grise. Arrêté sans résistance.',
      'Introductions par effraction (12 résidences)', sup, '2300, rue Wellington, Montréal', 45.4580, -73.5700, now() - interval '25 days', now() - interval '4 days')
    RETURNING id INTO c;
    INSERT INTO sighting (criminal_id, reported_by, location, notes, reported_at, latitude, longitude) VALUES
      (c, pol1, 'Rue Wellington, Verdun', 'Sortait d''une ruelle avec un sac de sport.', now() - interval '9 days', 45.4580, -73.5700),
      (c, pol2, 'Square Cabot', 'Interpellé par l''équipe de jour.', now() - interval '4 days 2 hours', 45.4885, -73.5803);
    INSERT INTO alert (issued_by, criminal_id, message, severity, created_at) VALUES
      (dir, c, 'Arrestation de Marc-André Bouffard, recherché pour une série d''introductions par effraction à Verdun. Son dossier passe au statut « capturé ». Merci aux équipes de jour pour leur travail.', 'info', now() - interval '4 days');
  END IF;

  -- 4. Recherché, dangereux : alerte urgente
  IF NOT EXISTS (SELECT 1 FROM criminal WHERE first_name = 'Yanick' AND last_name = 'Desormeaux') THEN
    INSERT INTO criminal (first_name, last_name, date_of_birth, nationality, status, description, crimes, added_by, last_known_address, latitude, longitude, added_at, updated_at)
    VALUES ('Yanick', 'Desormeaux', '1995-01-14', 'Canadienne', 'recherche',
      'Environ 1,85 m, carrure forte, cicatrice au menton. Peut être armé.',
      'Agression armée', sup, '9800, boulevard Saint-Michel, Montréal', 45.5640, -73.6300, now() - interval '6 days', now() - interval '6 days')
    RETURNING id INTO c;
    INSERT INTO sighting (criminal_id, reported_by, location, notes, reported_at, latitude, longitude) VALUES
      (c, pol2, 'Station Henri-Bourassa', 'Accompagné de deux personnes.', now() - interval '2 days 8 hours', 45.5556, -73.6672),
      (c, pol1, 'Parc Jarry, côté rue Faillon', 'Est parti en courant à la vue de l''auto-patrouille.', now() - interval '6 hours', 45.5333, -73.6280);
    INSERT INTO alert (issued_by, criminal_id, message, severity, created_at) VALUES
      (sup, c, 'Yanick Desormeaux signalé au parc Jarry. Il peut être armé. Ne pas l''approcher seul; demander du renfort et garder la distance.', 'urgent', now() - interval '5 hours');
  END IF;

  -- 5. Libérée
  IF NOT EXISTS (SELECT 1 FROM criminal WHERE first_name = 'Émilie' AND last_name = 'Ravary') THEN
    INSERT INTO criminal (first_name, last_name, date_of_birth, nationality, status, description, crimes, added_by, added_at, updated_at)
    VALUES ('Émilie', 'Ravary', '1999-07-03', 'Canadienne', 'libere',
      'Libérée sous conditions; doit se présenter au poste chaque lundi.',
      'Vols à l''étalage répétés', pol1, now() - interval '30 days', now() - interval '10 days');
  END IF;

  -- 6. Recherché, trafic
  IF NOT EXISTS (SELECT 1 FROM criminal WHERE first_name = 'Jonathan' AND last_name = 'Brisebois') THEN
    INSERT INTO criminal (first_name, last_name, date_of_birth, nationality, status, description, crimes, added_by, last_known_address, latitude, longitude, added_at, updated_at)
    VALUES ('Jonathan', 'Brisebois', '1986-09-17', 'Canadienne', 'recherche',
      'Environ 1,78 m, lunettes, conduit une berline grise.',
      'Trafic de stupéfiants', sup, '7200, rue Saint-Hubert, Montréal', 45.5360, -73.6090, now() - interval '15 days', now() - interval '15 days')
    RETURNING id INTO c;
    INSERT INTO sighting (criminal_id, reported_by, location, notes, reported_at, latitude, longitude) VALUES
      (c, pol1, 'Rue Saint-Hubert, Petite-Italie', 'Berline grise stationnée en double.', now() - interval '7 days', 45.5360, -73.6090),
      (c, pol2, 'Montréal-Nord, boulevard Henri-Bourassa', 'Échange rapide avec un piéton.', now() - interval '3 days', 45.5880, -73.6330),
      (c, pol1, 'Place Versailles', NULL, now() - interval '20 hours', 45.5918, -73.5372);
  END IF;

  -- 7. Capturé, délit de fuite
  IF NOT EXISTS (SELECT 1 FROM criminal WHERE first_name = 'Patrick' AND last_name = 'Lussier') THEN
    INSERT INTO criminal (first_name, last_name, date_of_birth, nationality, status, description, crimes, added_by, added_at, updated_at)
    VALUES ('Patrick', 'Lussier', '1983-02-25', 'Canadienne', 'capture',
      'S''est présenté au poste avec son avocat.',
      'Délit de fuite', pol2, now() - interval '18 days', now() - interval '6 days');
  END IF;

  -- 8. Recherchée, fraude envers des aînés
  IF NOT EXISTS (SELECT 1 FROM criminal WHERE first_name = 'Mélissa' AND last_name = 'Corbeil') THEN
    INSERT INTO criminal (first_name, last_name, date_of_birth, nationality, status, description, crimes, added_by, last_known_address, latitude, longitude, added_at, updated_at)
    VALUES ('Mélissa', 'Corbeil', '1990-12-01', 'Canadienne', 'recherche',
      'Se présente comme employée d''une banque au téléphone, puis à domicile.',
      'Fraude envers des personnes âgées', dir, '3400, rue Sherbrooke Est, Montréal', 45.5480, -73.5530, now() - interval '9 days', now() - interval '9 days')
    RETURNING id INTO c;
    INSERT INTO sighting (criminal_id, reported_by, location, notes, reported_at, latitude, longitude) VALUES
      (c, pol2, 'Rue Sherbrooke Est, près du Jardin botanique', 'Sortait d''une résidence pour aînés.', now() - interval '4 days 5 hours', 45.5600, -73.5560);
    INSERT INTO alert (issued_by, criminal_id, message, severity, created_at) VALUES
      (dir, c, 'Rappel aux équipes : plusieurs aînés de l''est de la ville ont reçu des appels d''une fausse employée de banque. Toute plainte semblable doit être liée au dossier de Mélissa Corbeil.', 'info', now() - interval '4 days 3 hours');
  END IF;

  -- 9. Recherché, vol qualifié
  IF NOT EXISTS (SELECT 1 FROM criminal WHERE first_name = 'Dominic' AND last_name = 'Vaillancourt') THEN
    INSERT INTO criminal (first_name, last_name, date_of_birth, nationality, status, description, crimes, added_by, last_known_address, latitude, longitude, added_at, updated_at)
    VALUES ('Dominic', 'Vaillancourt', '1997-05-19', 'Canadienne', 'recherche',
      'Environ 1,70 m, mince, manteau rouge au moment des faits.',
      'Vol qualifié dans un dépanneur', pol1, '5600, rue de Verdun, Montréal', 45.4560, -73.5750, now() - interval '3 days', now() - interval '3 days')
    RETURNING id INTO c;
    INSERT INTO sighting (criminal_id, reported_by, location, notes, reported_at, latitude, longitude) VALUES
      (c, pol1, 'Vieux-Port, quai de l''Horloge', 'Manteau rouge, sac à dos noir.', now() - interval '1 day 6 hours', 45.5075, -73.5520);
  END IF;

  -- 10. Libéré
  IF NOT EXISTS (SELECT 1 FROM criminal WHERE first_name = 'Stéphane' AND last_name = 'Gendreau') THEN
    INSERT INTO criminal (first_name, last_name, date_of_birth, nationality, status, description, crimes, added_by, added_at, updated_at)
    VALUES ('Stéphane', 'Gendreau', '1975-08-09', 'Canadienne', 'libere',
      'Conditions de probation rétablies par le tribunal.',
      'Bris de probation', sup, now() - interval '28 days', now() - interval '12 days');
  END IF;

  -- 11. Recherché, incendie criminel : alerte urgente
  IF NOT EXISTS (SELECT 1 FROM criminal WHERE first_name = 'Alexandre' AND last_name = 'Pépin') THEN
    INSERT INTO criminal (first_name, last_name, date_of_birth, nationality, status, description, crimes, added_by, last_known_address, latitude, longitude, added_at, updated_at)
    VALUES ('Alexandre', 'Pépin', '1992-10-27', 'Canadienne', 'recherche',
      'Environ 1,82 m, cheveux roux, voix rauque. A déjà menacé des témoins.',
      'Incendie criminel', sup, '1500, rue Atateken, Montréal', 45.5190, -73.5590, now() - interval '2 days', now() - interval '2 days')
    RETURNING id INTO c;
    INSERT INTO sighting (criminal_id, reported_by, location, notes, reported_at, latitude, longitude) VALUES
      (c, pol2, 'Parc La Fontaine, côté rue Rachel', 'Bidon d''essence dans un sac.', now() - interval '1 day 20 hours', 45.5266, -73.5695),
      (c, pol1, 'Gare Centrale, hall principal', 'Achetait un billet de train.', now() - interval '3 hours', 45.4996, -73.5664);
    INSERT INTO alert (issued_by, criminal_id, message, severity, created_at) VALUES
      (sup, c, 'Alexandre Pépin vu à la Gare Centrale il y a quelques minutes. Il pourrait quitter la ville. Équipes du centre-ville : surveiller les quais et prévenir la sécurité de la gare.', 'urgent', now() - interval '2 hours 50 minutes');
  END IF;

  -- 12. Capturée, recel
  IF NOT EXISTS (SELECT 1 FROM criminal WHERE first_name = 'Karine' AND last_name = 'Daigle') THEN
    INSERT INTO criminal (first_name, last_name, date_of_birth, nationality, status, description, crimes, added_by, added_at, updated_at)
    VALUES ('Karine', 'Daigle', '1984-04-04', 'Canadienne', 'capture',
      'Arrêtée lors d''une perquisition; marchandise volée récupérée.',
      'Recel de biens volés', pol2, now() - interval '22 days', now() - interval '2 days');
    INSERT INTO alert (issued_by, criminal_id, message, severity, created_at)
      SELECT dir, id, 'Karine Daigle a été arrêtée mardi lors d''une perquisition. Les biens retrouvés sont à l''inventaire; les victimes seront contactées par l''équipe des enquêtes.', 'info', now() - interval '2 days'
      FROM criminal WHERE first_name = 'Karine' AND last_name = 'Daigle';
  END IF;

  -- 13. Recherché, menaces
  IF NOT EXISTS (SELECT 1 FROM criminal WHERE first_name = 'Luc' AND last_name = 'Hamelin') THEN
    INSERT INTO criminal (first_name, last_name, date_of_birth, nationality, status, description, crimes, added_by, last_known_address, latitude, longitude, added_at, updated_at)
    VALUES ('Luc', 'Hamelin', '1969-03-15', 'Canadienne', 'recherche',
      'Environ 1,77 m, cheveux gris, boite légèrement de la jambe droite.',
      'Menaces et harcèlement', pol1, '6500, avenue Christophe-Colomb, Montréal', 45.5370, -73.6040, now() - interval '11 days', now() - interval '11 days')
    RETURNING id INTO c;
    INSERT INTO sighting (criminal_id, reported_by, location, notes, reported_at, latitude, longitude) VALUES
      (c, pol2, 'Station Côte-Vertu', 'Seul, attendait l''autobus 121.', now() - interval '6 days', 45.5141, -73.6829);
  END IF;

  -- Communiqué général, sans dossier lié (une seule fois)
  IF NOT EXISTS (SELECT 1 FROM alert WHERE severity = 'info' AND message LIKE 'Rappel : un signalement utile%') THEN
    INSERT INTO alert (issued_by, criminal_id, message, severity, created_at) VALUES
      (dir, NULL, 'Rappel : un signalement utile donne l''heure, le lieu précis et une description (vêtements, direction prise). Placez-le sur la carte quand c''est possible.', 'info', now() - interval '7 days');
  END IF;
END $$;
