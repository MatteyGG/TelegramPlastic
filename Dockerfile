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


# Копируем собранный проект
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/config ./config

# Volume для логов и конфигов
# ("logs/bot.log" )
# ("logs/requests.log")

VOLUME ["/app/config", "/app/logs"]

CMD ["node", "dist/bot.js"]

#docker buildx build  --platform linux/arm64,linux/amd64  -t ghcr.io/matteygg/telegram-plastic:latest  --load .
# -v "D:/Code/test/config:/app/config" -v "${PWD}/logs:/app/logs"
#docker run -it --rm --env-file .env ghcr.io/matteygg/telegram-plastic:latest