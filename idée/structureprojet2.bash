#!/usr/bin/env bash

cat <<'TREE'
projet-DA_2-mondat-3/
├── backend/
│   ├── .env
│   ├── .gitignore
│   ├── basededonnees.sqlite3
│   ├── mondat-2 api.yaml
│   ├── package-lock.json
│   ├── package.json
│   ├── requette.http
│   ├── server.js
│   ├── src/
│   │   ├── app.js
│   │   ├── config/
│   │   │   ├── basededonnees.js
│   │   │   ├── configuration.js
│   │   │   └── type_demande.js
│   │   ├── controllers/
│   │   │   ├── authentification.controller.js
│   │   │   ├── clients.controller.js
│   │   │   ├── documents.controller.js
│   │   │   ├── dossiers.controller.js
│   │   │   ├── factures.controller.js
│   │   │   ├── notes.controller.js
│   │   │   ├── roles.controller.js
│   │   │   ├── uploads.controller.js
│   │   │   └── utilisateurs.controller.js
│   │   ├── middleware/
│   │   │   ├── authentification.middleware.js
│   │   │   ├── avatar.middleware.js
│   │   │   ├── erreur.middleware.js
│   │   │   ├── rbac.middleware.js
│   │   │   └── telechargement.middleware.js
│   │   ├── models/
│   │   │   ├── client.model.js
│   │   │   ├── document.model.js
│   │   │   ├── dossier.model.js
│   │   │   ├── facture.model.js
│   │   │   ├── note.model.js
│   │   │   ├── role.model.js
│   │   │   └── utilisateur.model.js
│   │   ├── routes/
│   │   │   ├── authentification.routes.js
│   │   │   ├── clients.routes.js
│   │   │   ├── documents.routes.js
│   │   │   ├── dossiers.routes.js
│   │   │   ├── factures.routes.js
│   │   │   ├── notes.routes.js
│   │   │   ├── roles.routes.js
│   │   │   ├── uploads.routes.js
│   │   │   └── utilisateurs.routes.js
│   │   ├── services/
│   │   │   ├── authentification.service.js
│   │   │   ├── clients.service.js
│   │   │   ├── documents.service.js
│   │   │   ├── dossiers.service.js
│   │   │   ├── factures.service.js
│   │   │   ├── notes.service.js
│   │   │   ├── pdf.service.js
│   │   │   └── utilisateurs.service.js
│   │   ├── uploads/
│   │   │   ├── avatars/
│   │   │   └── documents/
│   │   └── utils/
│   │       ├── assurance_automobile.js
│   │       ├── assurance_habitation.js
│   │       ├── assurance_maladie.js
│   │       ├── assurance_mobilier.js
│   │       ├── assurance_vie.js
│   │       ├── assurance_voyage.js
│   │       ├── journal.js
│   │       └── validateurs.js
│   ├── test-api.js
│   └── tests/
│       ├── configEnv.js
│       ├── configurationGlobale.js
│       ├── permissions.test.js
│       └── smoke.test.js
├── frontend/
│   ├── .gitignore
│   ├── eslint.config.js
│   ├── index.html
│   ├── package-lock.json
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── assets/
│       │   ├── login_bg.png
│       │   ├── logo.svg
│       │   └── vite.svg
│       ├── composants/
│       │   ├── AuthContext.js
│       │   ├── AuthProvider.jsx
│       │   ├── FactureList.jsx
│       │   ├── Layout.jsx
│       │   ├── Menu.jsx
│       │   ├── NotificationContext.js
│       │   ├── NotificationProvider.jsx
│       │   ├── PrivateRoute.jsx
│       │   └── UserProfileMenu.jsx
│       ├── da.svg
│       ├── dashboard.jsx
│       ├── hooks/
│       │   ├── useDashboardData.js
│       │   └── useNotify.js
│       ├── logo.svg
│       ├── main.jsx
│       ├── NoMatch.jsx
│       ├── pages/
│       │   ├── admin/
│       │   │   └── DashboardAdmin.jsx
│       │   ├── Administration.jsx
│       │   ├── agent/
│       │   │   └── DashboardAgent.jsx
│       │   ├── auth.jsx
│       │   ├── Clients.jsx
│       │   ├── comptable/
│       │   │   └── DashboardComptable.jsx
│       │   ├── DemandesPage.jsx
│       │   ├── Documents.jsx
│       │   ├── Dossiers.jsx
│       │   ├── Facturation.jsx
│       │   ├── Home.jsx
│       │   └── Profile.jsx
│       ├── routes/
│       │   └── Router.jsx
│       └── styles/
│           ├── Administration.css
│           ├── app.css
│           ├── Clients.css
│           ├── dashboard.css
│           ├── Demandes.css
│           ├── Documents.css
│           ├── Dossiers.css
│           ├── Facturation.css
│           └── Profile.css
├── scratch/
│   └── check_roles.js
├── .gitignore
├── arbo.txt
├── audit_complet.md
├── corrections_appliquees.md
├── package-lock.json
├── plan.md
├── projet 2.pptx
├── README.md
└── structure.bash
TREE
