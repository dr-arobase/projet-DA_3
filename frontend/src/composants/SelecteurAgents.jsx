import { useState } from 'react';
import { IconeRecherche } from './Icones.jsx';
import { nomAgent } from '../agents.js';

// Liste d'agents à cocher, avec recherche par matricule, prénom ou nom (création de groupe, ajout de membres)
export default function SelecteurAgents({ agents, choisis, onChange }) {
  const [recherche, setRecherche] = useState('');
  const terme = recherche.trim().toLowerCase();
  const filtres = agents.filter((a) => !terme || `${a.badge_number} ${nomAgent(a)}`.toLowerCase().includes(terme));

  function basculer(id) {
    onChange(choisis.includes(id) ? choisis.filter((x) => x !== id) : [...choisis, id]);
  }

  return (
    <div className="selecteur-agents">
      <label className="registre-recherche">
        <IconeRecherche taille={15} />
        <input
          type="search"
          placeholder="Matricule, prénom ou nom…"
          aria-label="Chercher un agent à ajouter"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
      </label>
      <ul>
        {filtres.map((a) => (
          <li key={a.id}>
            <label className="case">
              <input type="checkbox" checked={choisis.includes(a.id)} onChange={() => basculer(a.id)} />
              <span>{a.badge_number} · {nomAgent(a)}</span>
            </label>
          </li>
        ))}
        {filtres.length === 0 && <li className="registre-note">Aucun agent.</li>}
      </ul>
    </div>
  );
}
