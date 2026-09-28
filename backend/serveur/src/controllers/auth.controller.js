import bcrypt from 'bcryptjs';
import * as userModel from '../models/user.model.js';
import { SESSION_COOKIE } from '../middleware/auth.middleware.js';
import { signSession, SESSION_DURATION_MS } from '../utils/jwt.js';
import { validateLogin } from '../utils/validators.js';

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.COOKIE_SECURE === 'true',
});

function publicUser(user) {
  const { id, first_name, last_name, badge_number, role, grade } = user;
  return { id, first_name, last_name, badge_number, role, grade };
}

// POST /auth/login
export async function login(req, res, next) {
  const { value, errors } = validateLogin(req.body);
  if (Object.keys(errors).length) {
    return res.status(400).json({ message: 'Le matricule et le mot de passe sont requis.', errors });
  }

  try {
    const user = await userModel.findByBadge(value.badge_number);
    // Même message que le matricule ou le mot de passe soit faux : on ne révèle pas lequel.
    if (!user || !(await bcrypt.compare(value.password, user.password_hash))) {
      return res.status(401).json({ message: 'Matricule ou mot de passe invalide.' });
    }
    if (!user.is_active) {
      return res.status(403).json({ message: 'Ce compte est désactivé. Contactez votre superviseur.' });
    }

    res.cookie(SESSION_COOKIE, signSession(user), { ...cookieOptions(), maxAge: SESSION_DURATION_MS });
    return res.json({ message: 'Connexion réussie.', user: publicUser(user) });
  } catch (err) {
    return next(err);
  }
}

// POST /auth/logout
export function logout(req, res) {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
  res.status(204).end();
}

// GET /auth/me
export function me(req, res) {
  res.json({ user: publicUser(req.user) });
}
