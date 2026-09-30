# Utilise Node.js 24 sur Alpine Linux comme image de base legere.
FROM node:24-alpine

# Definit /app comme repertoire de travail dans l'image.
WORKDIR /app

# Copie les manifestes npm avant le code pour reutiliser le cache des dependances.
COPY package.json package-lock.json ./
# Copie le manifeste du backend dans le chemin attendu par npm.
COPY serveur/package.json serveur/
# Copie le manifeste du client dans le chemin attendu par npm.
COPY client/package.json client/
# Installe les dependances de production du workspace npm nomme "serveur".
# Cette commande suppose que le workspace est declare dans le package.json racine.
RUN npm ci -w serveur --omit=dev

# Copie le reste des fichiers du projet dans l'image.
COPY . .

# Indique que le conteneur utilise le port 3000; cela ne publie pas le port a lui seul.
EXPOSE 3000

# Lance le script "dev" du package npm au demarrage du conteneur.
CMD ["npm", "run", "dev"]