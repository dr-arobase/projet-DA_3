import { useState } from 'react';
import { urlApi } from '../config.js';

// Photo de profil de l'agent, ou ses initiales s'il n'en a pas (ou si l'image ne charge pas)
export default function Avatar({ utilisateur, className = 'avatar' }) {
  const [urlEnErreur, setUrlEnErreur] = useState(null);

  const prenom = utilisateur?.first_name ?? '';
  const nom = utilisateur?.last_name ?? '';
  const initiales = `${prenom[0] ?? ''}${nom[0] ?? ''}`.toUpperCase() || '?';
  // La photo est servie par l'API (/api/uploads/…), qui peut être sur un autre site
  const url = utilisateur?.avatar_url?.startsWith('/api/') ? urlApi(utilisateur.avatar_url) : utilisateur?.avatar_url;

  if (url && url !== urlEnErreur) {
    return (
      <img
        className={`${className} avatar-photo`}
        src={url}
        alt={`Photo de ${prenom} ${nom}`.trim()}
        onError={() => setUrlEnErreur(url)}
      />
    );
  }
  return <span className={className} aria-hidden="true">{initiales}</span>;
}
