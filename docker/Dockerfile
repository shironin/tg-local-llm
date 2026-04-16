FROM node:20-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json tsconfig.json ./
COPY src/ ./src/
COPY prompts/ ./prompts/

CMD ["sh", "-c", "npm install && npm start"]
