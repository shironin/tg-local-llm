FROM node:20-alpine

WORKDIR /app

COPY package.json tsconfig.json ./
COPY src/ ./src/

CMD ["sh", "-c", "npm install && npm start"]
