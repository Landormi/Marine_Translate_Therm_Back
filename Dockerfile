# Utiliser une image Node.js officielle version 20 comme base
FROM node:20.15.0

# Définir le répertoire de travail dans le conteneur
WORKDIR /usr/src/app

# Copier package.json et package-lock.json dans le répertoire de travail
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier le reste du code de l'application dans le répertoire de travail
COPY . .

# Exposer le port que votre application utilisera
EXPOSE 3000

# Définir la commande pour exécuter votre application
CMD ["node", "server.js"]
