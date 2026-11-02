import express from 'express';
import path from 'node:path';
import { UPLOADS_DIR } from './upload.middleware.js';

// Pièces jointes de la messagerie (#57) et messages vocaux (#59).
// Rangées hors de /api/uploads : elles ne sont servies que par GET /api/messages/:id/attachment,
// qui vérifie que l'agent participe à la conversation.
export const ATTACHMENTS_DIR = path.join(UPLOADS_DIR, 'messages');

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 Mo

// Type MIME accepté -> extension enregistrée et genre affiché (image dans le fil, lecteur audio, ou lien)
export const ATTACHMENT_TYPES = {
  'image/jpeg': { ext: 'jpg', kind: 'image' },
  'image/png': { ext: 'png', kind: 'image' },
  'image/webp': { ext: 'webp', kind: 'image' },
  'image/gif': { ext: 'gif', kind: 'image' },
  'application/pdf': { ext: 'pdf', kind: 'file' },
  'audio/webm': { ext: 'webm', kind: 'audio' },
  'audio/ogg': { ext: 'ogg', kind: 'audio' },
  'audio/mp4': { ext: 'm4a', kind: 'audio' },
  'audio/mpeg': { ext: 'mp3', kind: 'audio' },
};

// « audio/webm;codecs=opus » -> « audio/webm »
export const baseType = (contentType = '') => contentType.split(';')[0].trim().toLowerCase();

// Corps brut de la requête, seulement pour les types acceptés (les autres ne sont pas lus : refusés).
const lireCorps = express.raw({
  type: (req) => Boolean(ATTACHMENT_TYPES[baseType(req.headers['content-type'])]),
  limit: MAX_ATTACHMENT_SIZE,
});

// Au-delà de 10 Mo, un message clair en français plutôt que « request entity too large »
export function readAttachment(req, res, next) {
  lireCorps(req, res, (err) => {
    if (err?.status === 413) return res.status(413).json({ message: 'Le fichier dépasse 10 Mo' });
    return next(err);
  });
}

const commencePar = (data, octets, decalage = 0) =>
  data.subarray(decalage, decalage + octets.length).equals(Buffer.from(octets));

// Vérifie les premiers octets du fichier : le Content-Type et l'extension se falsifient facilement.
// HTML, SVG, exécutables… ne correspondent à aucune signature et sont refusés.
export function isAllowedFile(contentType, data) {
  const type = baseType(contentType);
  if (!ATTACHMENT_TYPES[type] || !Buffer.isBuffer(data) || data.length < 12) return false;
  switch (type) {
    case 'image/jpeg':
      return commencePar(data, [0xff, 0xd8, 0xff]);
    case 'image/png':
      return commencePar(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/webp':
      return data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP';
    case 'image/gif':
      return ['GIF87a', 'GIF89a'].includes(data.toString('ascii', 0, 6));
    case 'application/pdf':
      return data.toString('ascii', 0, 5) === '%PDF-';
    case 'audio/webm':
      return commencePar(data, [0x1a, 0x45, 0xdf, 0xa3]); // en-tête EBML (Chrome, Firefox)
    case 'audio/ogg':
      return data.toString('ascii', 0, 4) === 'OggS';
    case 'audio/mp4':
      return data.toString('ascii', 4, 8) === 'ftyp'; // Safari enregistre en MP4
    case 'audio/mpeg':
      return data.toString('ascii', 0, 3) === 'ID3' || (data[0] === 0xff && (data[1] & 0xe0) === 0xe0);
    default:
      return false;
  }
}

// Nom affiché : sans chemin ni caractère de contrôle, 255 caractères au plus
export function cleanFileName(nom, extension) {
  const propre = [...String(nom ?? '').replace(/^.*[\\/]/, '')]
    .filter((c) => c.charCodeAt(0) > 31 && c.charCodeAt(0) !== 127)
    .join('')
    .trim()
    .slice(0, 255);
  return propre || `fichier.${extension}`;
}
