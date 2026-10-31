import crypto from 'node:crypto';
import express from 'express';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Serveur STUN public : trouve l'adresse de chaque navigateur (suffit sur la plupart des Wi-Fi).
const STUN = { urls: 'stun:stun.l.google.com:19302' };

// Les identifiants TURN valent 12 h : coturn les revérifie pendant tout l'appel.
const DUREE_IDENTIFIANTS_S = 12 * 60 * 60;

// Identifiants TURN temporaires (méthode « REST API » de coturn, option use-auth-secret) :
// nom = <expiration>:<id de l'agent>, mot de passe = HMAC-SHA1(secret partagé, nom) en base64.
// Le secret reste sur le serveur ; le navigateur ne reçoit qu'un mot de passe qui expire.
export function serveursIce(userId, { urls = process.env.TURN_URLS, secret = process.env.TURN_SECRET, maintenant = Date.now() } = {}) {
  const listeUrls = (urls ?? '').split(',').map((u) => u.trim()).filter(Boolean);
  if (!listeUrls.length || !secret) return [STUN];

  const expiration = Math.floor(maintenant / 1000) + DUREE_IDENTIFIANTS_S;
  const username = `${expiration}:${userId}`;
  const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');
  return [STUN, { urls: listeUrls, username, credential }];
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
