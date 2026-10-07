// Valeurs partagées par les pages Annuaire et Utilisateurs (rôles et grades de app_user, voir database/schema.sql)
export const ROLES = ['policier', 'superviseur', 'direction'];

export const LIBELLES_ROLE = {
  policier: 'Policier',
  superviseur: 'Superviseur',
  direction: 'Direction',
};

export const LIBELLES_GRADE = {
  sergent_autres_fonctions: 'Sergent (autres fonctions)',
  sergent_gestionnaire: 'Sergent gestionnaire',
  sergent_responsable_de_poste: 'Sergent responsable de poste',
  lieutenant: 'Lieutenant',
  capitaine: 'Capitaine',
  inspecteur: 'Inspecteur',
  inspecteur_chef: 'Inspecteur-chef',
  directeur_general_adjoint: 'Directeur général adjoint',
  directeur_general: 'Directeur général',
};

// Grades proposés selon le rôle choisi
export const GRADES_PAR_ROLE = {
  policier: ['sergent_autres_fonctions'],
  superviseur: [
    'sergent_gestionnaire', 'sergent_responsable_de_poste', 'lieutenant',
    'capitaine', 'inspecteur', 'inspecteur_chef',
  ],
  direction: ['directeur_general_adjoint', 'directeur_general'],
};

const NIVEAUX = { policier: 1, superviseur: 2, direction: 3 };

// Même règle que requireRole côté serveur : estAuMoins(u, 'superviseur') vaut aussi pour la direction
export const estAuMoins = (utilisateur, role) => (NIVEAUX[utilisateur?.role] ?? 0) >= NIVEAUX[role];

export const nomAgent = (u) => `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim();
