FROM node:18-alpine

WORKDIR /app

# Copiem package.json i instal·lem dependències
COPY package*.json ./
RUN npm install

# Copiem la resta del codi
COPY . .

EXPOSE 3004

CMD ["npm", "run", "dev"]