FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["sh", "-c", "npm start"]

# docker build -t ghcr.io/matteygg/telegram-plastic:latest --platform linux/amd64,linux/arm64 . 