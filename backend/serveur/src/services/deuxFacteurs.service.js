// Double authentification (TOTP) : activation, vérification à la connexion, codes de secours,
// désactivation par l'agent et réinitialisation par la direction. Facultative pour tous les comptes.
import bcrypt from 'bcrypt';
import { pool as db } from '../config/db.js';
import * as auditLogModel from '../models/auditLog.model.js';
import {
  adresseOtpauth, chiffrer, dechiffrer, genererCodesSecours, genererSecret, normaliserCodeSecours, verifierCode,
} from '../utils/totp.js';

export const ESSAIS_MAX = 5;
export const BLOCAGE_MINUTES = 15;

const lireCompte = async (id) => {
  const { rows } = await db.query(
    `SELECT id, badge_number, password_hash, is_active, totp_secret, totp_secret_attente, totp_active,
            totp_dernier_pas, totp_codes_secours, totp_echecs, totp_bloque_jusqua
       FROM app_user WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
};

const journal = (actor_id, action, target_id, details = null) => auditLogModel.record({
  actor_id, action, target_type: 'user', target_id, details,
}).catch((err) => console.error(`Journal d'audit (${action}) :`, err.message));

// 1. Préparer l'activation : un nouveau secret, gardé « en attente » jusqu'au premier bon code.
// Le secret n'est montré qu'à ce moment (code QR et clé manuelle).
export async function preparer(userId) {
  const compte = await lireCompte(userId);
  if (!compte || !compte.is_active) throw new Error('INVALID_CREDENTIALS');
  if (compte.totp_active) throw new Error('TOTP_DEJA_ACTIVE');
  const secret = genererSecret();
  await db.query('UPDATE app_user SET totp_secret_attente = $1 WHERE id = $2', [chiffrer(secret), userId]);
  return { secret, adresse: adresseOtpauth(secret, compte.badge_number) };
}

// 2. Activer avec le premier code : la double authentification devient obligatoire pour ce compte.
// Retourne les 10 codes de secours, en clair une seule fois; seuls leurs hachages sont gardés.
export async function activer(userId, code) {
  const compte = await lireCompte(userId);
  if (!compte || !compte.is_active) throw new Error('INVALID_CREDENTIALS');
  if (compte.totp_active) throw new Error('TOTP_DEJA_ACTIVE');
  if (!compte.totp_secret_attente) throw new Error('TOTP_NON_PREPARE');
  const pas = verifierCode(dechiffrer(compte.totp_secret_attente), String(code ?? '').trim());
  if (pas === null) throw new Error('CODE_INVALIDE');

  const codesSecours = genererCodesSecours();
  const haches = await Promise.all(codesSecours.map((c) => bcrypt.hash(normaliserCodeSecours(c), 10)));
  await db.query(
    `UPDATE app_user SET totp_secret = totp_secret_attente, totp_secret_attente = NULL, totp_active = true,
            totp_dernier_pas = $1, totp_codes_secours = $2, totp_echecs = 0, totp_bloque_jusqua = NULL
      WHERE id = $3`,
    [pas, haches, userId]
  );
  journal(userId, 'TOTP_ACTIVATED', userId);
  return { codesSecours };
}

// Vérifie un code à 6 chiffres ou un code de secours pour un compte où la double authentification est active.
// 5 mauvais codes bloquent le compte 15 minutes; un code déjà accepté est refusé; un code de secours ne sert qu'une fois.
export async function verifier(userId, code) {
  const compte = await lireCompte(userId);
  if (!compte || !compte.is_active) throw new Error('INVALID_CREDENTIALS');
  if (!compte.totp_active) throw new Error('TOTP_INACTIVE');
  if (compte.totp_bloque_jusqua && new Date(compte.totp_bloque_jusqua) > new Date()) {
    const err = new Error('TOTP_BLOQUE');
    err.jusqua = compte.totp_bloque_jusqua;
    throw err;
  }

  const saisie = String(code ?? '').trim();
  let accepte = false;
  if (/^\d{6}$/.test(saisie)) {
    const pas = verifierCode(dechiffrer(compte.totp_secret), saisie, { dernierPas: compte.totp_dernier_pas });
    if (pas !== null) {
      // La condition sur le pas empêche deux connexions simultanées d'utiliser le même code
      const { rowCount } = await db.query(
        `UPDATE app_user SET totp_dernier_pas = $1, totp_echecs = 0, totp_bloque_jusqua = NULL
          WHERE id = $2 AND (totp_dernier_pas IS NULL OR totp_dernier_pas < $1)`,
        [pas, userId]
      );
      accepte = rowCount === 1;
    }
  } else if (saisie.length >= 8) {
    const normalise = normaliserCodeSecours(saisie);
    const restants = compte.totp_codes_secours ?? [];
    for (const hache of restants) {
      if (await bcrypt.compare(normalise, hache)) {
        const { rowCount } = await db.query(
          `UPDATE app_user SET totp_codes_secours = array_remove(totp_codes_secours, $1),
                  totp_echecs = 0, totp_bloque_jusqua = NULL
            WHERE id = $2 AND $1 = ANY(totp_codes_secours)`,
          [hache, userId]
        );
        accepte = rowCount === 1;
        if (accepte) journal(userId, 'TOTP_RECOVERY_CODE_USED', userId, { restants: restants.length - 1 });
        break;
      }
    }
  }

  if (!accepte) {
    const { rows } = await db.query(
      `UPDATE app_user
          SET totp_echecs = CASE WHEN totp_echecs + 1 >= $2 THEN 0 ELSE totp_echecs + 1 END,
              totp_bloque_jusqua = CASE WHEN totp_echecs + 1 >= $2
                                        THEN now() + make_interval(mins => $3) ELSE totp_bloque_jusqua END
        WHERE id = $1
        RETURNING totp_bloque_jusqua`,
      [userId, ESSAIS_MAX, BLOCAGE_MINUTES]
    );
    journal(null, 'TOTP_CODE_FAILED', userId);
    const bloque = rows[0]?.totp_bloque_jusqua && new Date(rows[0].totp_bloque_jusqua) > new Date();
    const err = new Error(bloque ? 'TOTP_BLOQUE' : 'CODE_INVALIDE');
    if (bloque) err.jusqua = rows[0].totp_bloque_jusqua;
    throw err;
  }
}

const EFFACER = `totp_secret = NULL, totp_secret_attente = NULL, totp_active = false, totp_dernier_pas = NULL,
                 totp_codes_secours = NULL, totp_echecs = 0, totp_bloque_jusqua = NULL`;

// L'agent désactive sa double authentification : mot de passe (s'il en a un) ET un code valide
export async function desactiver(userId, { motDePasse, code }) {
  const compte = await lireCompte(userId);
  if (!compte || !compte.is_active) throw new Error('INVALID_CREDENTIALS');
  if (!compte.totp_active) throw new Error('TOTP_INACTIVE');
  if (compte.password_hash) {
    if (typeof motDePasse !== 'string' || !(await bcrypt.compare(motDePasse, compte.password_hash))) {
      throw new Error('WRONG_PASSWORD');
    }
  }
  await verifier(userId, code);
  await db.query(`UPDATE app_user SET ${EFFACER} WHERE id = $1`, [userId]);
  journal(userId, 'TOTP_DEACTIVATED', userId);
}

// La direction réinitialise la double authentification d'un agent qui a perdu son téléphone.
// Elle ne le fait pas pour son propre compte : elle passe par « Désactiver », qui demande un code.
export async function reinitialiser(acteur, cibleId) {
  if (Number(cibleId) === Number(acteur.id)) throw new Error('SELF_RESET_FORBIDDEN');
  const compte = await lireCompte(cibleId);
  if (!compte) throw new Error('USER_NOT_FOUND');
  if (!compte.totp_active && !compte.totp_secret_attente) throw new Error('TOTP_INACTIVE');
  await db.query(`UPDATE app_user SET ${EFFACER} WHERE id = $1`, [cibleId]);
    // Attendu : la réponse part une fois l'action inscrite au journal (sinon le test, ou un auditeur
  // qui consulte le journal juste après, ne la voit pas encore). journal() attrape déjà ses erreurs.
  await journal(acteur.id, 'TOTP_RESET', Number(cibleId), { badge_number: compte.badge_number });
}

// La double authentification est-elle active ? (connexion par mot de passe ou par GitHub)
export async function estActive(userId) {
  const { rows } = await db.query('SELECT totp_active FROM app_user WHERE id = $1', [userId]);
  return rows[0]?.totp_active === true;
}
