import 'dotenv/config';
import bcrypt from 'bcrypt';
import { pool, closeDatabase } from '../serveur/src/config/db.js';

const password = process.argv[2];
if (!password) {
  console.error('Usage : node scripts/set-passwords.js <motDePasse>');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
const { rowCount } = await pool.query('UPDATE app_user SET password_hash = $1', [hash]);
console.log(`${rowCount} mot(s) de passe mis à jour.`);

await closeDatabase();

//Ce que fait le script : import 'dotenv/config' charge ton .env, bcrypt.hash transforme le mot de passe en hash, et le UPDATE l'applique aux 4 utilisateurs. Le mot de passe est celui qu'on passe en argument.