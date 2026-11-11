// Double authentification : codes à usage unique basés sur le temps (TOTP, RFC 6238),
// compatibles avec Google Authenticator, Microsoft Authenticator et les autres applications.
// Écrit avec le module crypto de Node : aucune dépendance de plus.
import {
  createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual,
} from 'node:crypto';

export const PERIODE = 30; // secondes par code
export const CHIFFRES = 6;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encoder(octets) {
  let resultat = '';
  let tampon = 0;
  let bits = 0;
  for (const octet of octets) {
    tampon = (tampon << 8) | octet;
    bits += 8;
    while (bits >= 5) {
      resultat += BASE32[(tampon >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) resultat += BASE32[(tampon << (5 - bits)) & 31];
  return resultat;
}

export function base32Decoder(texte) {
  const propre = String(texte).toUpperCase().replace(/[\s=]/g, '');
  const octets = [];
  let tampon = 0;
  let bits = 0;
  for (const lettre of propre) {
    const valeur = BASE32.indexOf(lettre);
    if (valeur === -1) throw new Error('INVALID_SECRET');
    tampon = (tampon << 5) | valeur;
    bits += 5;
    if (bits >= 8) {
      octets.push((tampon >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(octets);
}

// Secret de 160 bits, la taille recommandée pour HMAC-SHA1
export const genererSecret = () => base32Encoder(randomBytes(20));

// Code du pas de temps donné (HOTP, RFC 4226)
export function codePourPas(secret, pas) {
  const compteur = Buffer.alloc(8);
  compteur.writeBigUInt64BE(BigInt(pas));
  const hmac = createHmac('sha1', base32Decoder(secret)).update(compteur).digest();
  const decalage = hmac[hmac.length - 1] & 0x0f;
  const nombre = (hmac.readUInt32BE(decalage) & 0x7fffffff) % 10 ** CHIFFRES;
  return String(nombre).padStart(CHIFFRES, '0');
}

export const pasActuel = (maintenant = Date.now()) => Math.floor(maintenant / 1000 / PERIODE);

// Vérifie un code à 6 chiffres. Tolère un pas avant ou après (horloge du téléphone en décalage).
// Retourne le pas reconnu, ou null. Un pas déjà utilisé (dernierPas) est refusé : un code ne sert qu'une fois.
export function verifierCode(secret, code, { maintenant = Date.now(), dernierPas = null, fenetre = 1 } = {}) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return null;
  const actuel = pasActuel(maintenant);
  for (let ecart = -fenetre; ecart <= fenetre; ecart += 1) {
    const pas = actuel + ecart;
    if (dernierPas !== null && pas <= Number(dernierPas)) continue;
    const attendu = Buffer.from(codePourPas(secret, pas));
    if (timingSafeEqual(attendu, Buffer.from(code))) return pas;
  }
  return null;
}

// Adresse lue par l'application d'authentification (contenu du code QR)
export function adresseOtpauth(secret, compte, emetteur = 'CrimeTracker') {
  const etiquette = encodeURIComponent(`${emetteur}:${compte}`);
  const params = new URLSearchParams({
    secret, issuer: emetteur, algorithm: 'SHA1', digits: String(CHIFFRES), period: String(PERIODE),
  });
  return `otpauth://totp/${etiquette}?${params}`;
}

// Codes de secours : 10 codes « ABCD-EFGH », sans lettres ambiguës (0/O, 1/I/L)
const ALPHABET_SECOURS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function genererCodesSecours(nombre = 10) {
  return Array.from({ length: nombre }, () => {
    const octets = randomBytes(8);
    const lettres = [...octets].map((o) => ALPHABET_SECOURS[o % ALPHABET_SECOURS.length]).join('');
    return `${lettres.slice(0, 4)}-${lettres.slice(4)}`;
  });
}
export const normaliserCodeSecours = (code) => String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');

// Chiffrement du secret en base (AES-256-GCM). La clé vient de TOTP_KEY, ou à défaut de JWT_SECRET :
// une copie de la base seule ne suffit pas à fabriquer des codes.
function cle() {
  const source = process.env.TOTP_KEY?.trim() || process.env.JWT_SECRET?.trim();
  if (!source) throw new Error('TOTP_KEY ou JWT_SECRET doit être définie pour la double authentification.');
  return Buffer.from(hkdfSync('sha256', source, 'crimetracker', 'totp-secret', 32));
}

export function chiffrer(texte) {
  const iv = randomBytes(12);
  const chiffreur = createCipheriv('aes-256-gcm', cle(), iv);
  const contenu = Buffer.concat([chiffreur.update(texte, 'utf8'), chiffreur.final()]);
  return [iv, chiffreur.getAuthTag(), contenu].map((b) => b.toString('base64')).join('.');
}

export function dechiffrer(valeur) {
  const [iv, etiquette, contenu] = String(valeur).split('.').map((p) => Buffer.from(p, 'base64'));
  const dechiffreur = createDecipheriv('aes-256-gcm', cle(), iv);
  dechiffreur.setAuthTag(etiquette);
  return Buffer.concat([dechiffreur.update(contenu), dechiffreur.final()]).toString('utf8');
}
