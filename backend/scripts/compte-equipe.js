// Crée (ou remet à neuf) le compte rapide de l'équipe dans une base déjà existante :
// matricule 1, mot de passe 2, rôle direction. Une base neuve l'a déjà (seed.sql).
//
//   Avec Docker   : docker compose exec api node scripts/compte-equipe.js
//   Sans Docker   : cd backend && node scripts/compte-equipe.js
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { pool, closeDatabase } from '../serveur/src/config/db.js';

const hash = await bcrypt.hash('2', 10);
const { rows } = await pool.query(
  `INSERT INTO app_user (first_name, last_name, badge_number, email, password_hash, role, grade, is_active)
   VALUES ('Test', 'Équipe', '1', 'equipe@crimetracker.local', $1, 'direction', 'directeur_general', TRUE)
   ON CONFLICT (badge_number) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = TRUE
   RETURNING badge_number, role`,
  [hash]
);
console.log(`Compte prêt : matricule ${rows[0].badge_number}, mot de passe 2 (${rows[0].role}).`);

await closeDatabase();
