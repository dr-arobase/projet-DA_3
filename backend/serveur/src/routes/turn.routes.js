import crypto from 'node:crypto';
import express from 'express';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();
const STUN = { urls: 'stun:stun.l.google.com:19302' };
const DUREE_IDENTIFIANTS_S = 12 * 60 * 60;

export function serveursIce(
  userId,
  { urls = process.env.TURN_URLS, secret = process.env.TURN_SECRET, maintenant = Date.now() } = {},
) {
  const listeUrls = (urls ?? '').split(',').map((url) => url.trim()).filter(Boolean);
  if (!listeUrls.length || !secret) return [STUN];

  const expiration = Math.floor(maintenant / 1000) + DUREE_IDENTIFIANTS_S;
  const username = `${expiration}:${userId}`;
  const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');
  return [STUN, { urls: listeUrls, username, credential }];
}

router.get('/', verifyToken, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ iceServers: serveursIce(req.user.id) });
});

export default router;
