# Image de production de l'API CrimeTracker (Express + Socket.IO).
# Construite par : docker compose up --build   (ou la CI, publiée sur ghcr.io)
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Les dépendances d'abord : cette couche reste en cache tant que package*.json ne change pas
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# Les photos de profil sont écrites par l'API : le dossier doit appartenir à l'utilisateur node
# et être accessible en écriture (construit depuis Windows/OneDrive, il arrive en lecture seule)
RUN mkdir -p serveur/src/uploads/avatars && chown -R node:node serveur/src/uploads \
  && chmod -R u+rwX serveur/src/uploads

# Le serveur tourne sans les droits root
USER node
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://localhost:3000/ > /dev/null || exit 1

CMD ["node", "serveur/src/server.js"]
