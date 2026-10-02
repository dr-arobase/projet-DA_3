import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Dossier des fichiers envoyés (servi sous /api/uploads, réservé aux agents connectés)
export const UPLOADS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');
export const AVATARS_DIR = path.join(UPLOADS_DIR, 'avatars');
export const AVATARS_URL = '/api/uploads/avatars';

export const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 Mo

// Type MIME accepté -> extension du fichier enregistré
export const AVATAR_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// Le navigateur envoie l'image brute dans le corps de la requête (Content-Type: image/…) :
// pas besoin de multipart/form-data ni de dépendance supplémentaire.
// Au-delà de 2 Mo, express.raw répond 413.
export const readAvatar = express.raw({ type: Object.keys(AVATAR_TYPES), limit: MAX_AVATAR_SIZE });

// Vérifie les premiers octets du fichier : un Content-Type se falsifie facilement
export function isImage(contentType, data) {
  if (!AVATAR_TYPES[contentType] || !Buffer.isBuffer(data) || data.length < 12) return false;
  switch (contentType) {
    case 'image/jpeg':
      return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
    case 'image/png':
      return data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/webp':
      return data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP';
    default:
      return false;
  }
}
