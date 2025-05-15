# Этап сборки
FROM node:22-alpine AS builder

WORKDIR /app

# Установка зависимостей сборки
RUN apk add --no-cache python3 make g++

# Копируем зависимости первыми для кэширования
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci

# Копируем исходники
COPY . .
COPY config ./config
COPY .env* ./

# Сборка проекта
RUN npm run build

# Этап выполнения
FROM node:22-alpine AS runner

WORKDIR /app

# Копируем собранный проект и конфиги с правами пользователя node
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/config ./config

# Создаем папку для логов и назначаем права
RUN mkdir -p /app/logs && chown -R node:node /app/logs

# Только logs монтируем как volume
VOLUME ["/app/logs"]

# Переключаемся на непривилегированного пользователя
USER node

CMD ["node","--max-old-space-size=4096", "dist/bot.js"]

#docker buildx build  --platform linux/arm64,linux/amd64  -t ghcr.io/matteygg/telegram-plastic:latest  --load .

# docker run -v "$(PWD)/logs:/app/logs" --env-file .env --memory=4g ghcr.io/matteygg/telegram-plastic:latest
# docker run -v "/root/telegram-bot/logs:/app/logs:Z" --env-file .env --memory=4g ghcr.io/matteygg/telegram-plastic:latest