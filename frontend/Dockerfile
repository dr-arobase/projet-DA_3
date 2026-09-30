# Image de production du frontend CrimeTracker.
# Étape 1 : Vite compile l'application React en fichiers statiques (dist/).
FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Étape 2 : nginx sert ces fichiers et relaie /api et /socket.io vers l'API.
# Le navigateur ne voit qu'une seule origine : le cookie de session httpOnly
# est donc envoyé automatiquement, sans CORS (comme le proxy Vite en dev).
FROM nginx:1.27-alpine

# Adresse de l'API vue depuis ce conteneur (nom du service dans compose.yml)
ENV API_URL=http://api:3000

# Le fichier .template est complété avec API_URL au démarrage du conteneur
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
