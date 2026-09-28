# Étape commune : Node et les manifestes de dépendances.
FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./

# Image des tests (docker compose run --rm tests) : avec les dépendances de développement.
FROM base AS test
RUN npm ci
COPY . .
CMD ["npm", "test"]

# Image de l'application : dépendances de production seulement.
FROM base AS production
ENV NODE_ENV=production
RUN npm ci --omit=dev
COPY . .
USER node
EXPOSE 3000
CMD ["node", "serveur/src/server.js"]
