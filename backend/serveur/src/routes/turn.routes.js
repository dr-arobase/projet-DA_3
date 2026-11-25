import crypto from 'node:crypto';
import express from 'express';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Serveurs STUN publics : trouvent l'adresse de chaque navigateur (suffit sur la plupart des Wi-Fi).
// Deux fournisseurs : si l'un ne répond pas, l'autre suffit.
export const STUN = { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] };

// Les identifiants TURN valent 12 h : coturn les revérifie pendant tout l'appel.
const DUREE_IDENTIFIANTS_S = 12 * 60 * 60;

// Deux façons de donner un relais TURN, selon ce qui est rempli dans .env :
// 1. Notre coturn (TURN_SECRET) : identifiants temporaires (méthode « REST API » de coturn, option
//    use-auth-secret) : nom = <expiration>:<id de l'agent>, mot de passe = HMAC-SHA1(secret, nom) en base64.
//    Le secret reste sur le serveur; le navigateur ne reçoit qu'un mot de passe qui expire.
// 2. Un relais hébergé (TURN_USERNAME et TURN_PASSWORD) : les identifiants fixes donnés par le fournisseur.
//    Il passe souvent par le port 443, que les réseaux d'école ou d'entreprise laissent ouvert.
export function serveursIce(userId, {
  urls = process.env.TURN_URLS,
  secret = process.env.TURN_SECRET,
  nom = process.env.TURN_USERNAME,
  motDePasse = process.env.TURN_PASSWORD,
  maintenant = Date.now(),
} = {}) {
  const listeUrls = (urls ?? '').split(',').map((u) => u.trim()).filter(Boolean);
  if (!listeUrls.length) return [STUN];

  if (secret) {
    const expiration = Math.floor(maintenant / 1000) + DUREE_IDENTIFIANTS_S;
    const username = `${expiration}:${userId}`;
    const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');
    return [STUN, { urls: listeUrls, username, credential }];
  }
  if (nom && motDePasse) return [STUN, { urls: listeUrls, username: nom, credential: motDePasse }];
  return [STUN];
}

// GET /api/turn : serveurs ICE pour un appel (#56).
// Le relais TURN fait passer le son et l'image quand la connexion directe est bloquée
// (données mobiles 4G/5G, pare-feu d'école ou d'entreprise). Réservé aux agents connectés,
// pour que le relais ne serve pas à n'importe qui.
router.get('/', verifyToken, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ iceServers: serveursIce(req.user.id) });
});

export default router;
