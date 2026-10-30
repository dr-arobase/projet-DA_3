const LOCAL_ORIGINS = ['http://localhost:8080', 'http://localhost:5173'];

export function getAllowedOrigins() {
  const configured = process.env.SOCKET_ALLOWED_ORIGINS;
  const origins = configured === undefined
    ? LOCAL_ORIGINS
    : configured.split(',').map((origin) => origin.trim()).filter(Boolean);

  if (origins.length === 0) {
    throw new Error('SOCKET_ALLOWED_ORIGINS doit contenir au moins une origine.');
  }

  for (const origin of origins) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`Origine Socket.IO invalide : ${origin}`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
      throw new Error(`Origine Socket.IO invalide : ${origin}`);
    }
  }

  return [...new Set(origins)];
}
