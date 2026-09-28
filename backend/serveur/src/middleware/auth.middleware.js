import * as userModel from '../models/user.model.js';
import { verifySession } from '../utils/jwt.js';

export const SESSION_COOKIE = 'session';

/**
 * Le compte actif associé au cookie de session, ou null. Le compte est relu en
 * base à chaque requête : un compte désactivé perd l'accès immédiatement.
 */
async function currentUser(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  const payload = verifySession(token);
  if (!payload) return null;
  const user = await userModel.findById(payload.sub);
  return user?.is_active ? user : null;
}

/** Pour l'API : 401 en JSON si personne n'est connecté. */
export async function authenticate(req, res, next) {
  try {
    const user = await currentUser(req);
    if (!user) {
      res.clearCookie(SESSION_COOKIE);
      return res.status(401).json({ message: 'Vous devez être connecté pour accéder à cette ressource.' });
    }
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

/** Pour les pages : redirige vers l'écran de connexion si personne n'est connecté. */
export async function requirePageAuth(req, res, next) {
  try {
    const user = await currentUser(req);
    if (!user) {
      res.clearCookie(SESSION_COOKIE);
      return res.redirect('/login');
    }
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}
