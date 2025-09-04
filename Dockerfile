# Этап сборки
FROM node:22-alpine AS builder

WORKDIR /app

# Установка зависимостей сборки
RUN apk add --no-cache python3 make g++ openssl-dev

# Копируем зависимости первыми для кэширования
COPY package*.json ./
COPY tsconfig.json ./
# Устанавливаем ВСЕ зависимости (включая devDependencies) для сборки
RUN npm ci

# Копируем исходники и Prisma схему
COPY . .
COPY .env* ./

# Генерируем Prisma клиент (это не требует подключения к БД)
RUN npx prisma generate

# Сборка TypeScript проекта
RUN npm run build

# Этап выполнения
FROM node:22-alpine AS runner

WORKDIR /app

# Устанавливаем wait4x из репозитория community
RUN echo "https://dl-cdn.alpinelinux.org/alpine/v3.22/community/" >> /etc/apk/repositories && \
    apk add --no-cache wait4x

# Устанавливаем зависимости только для production
COPY package*.json ./
RUN npm ci --only=production

# Копируем собранный проект
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=node:node /app/prisma ./prisma

# Создаем папку для логов
RUN mkdir -p /app/logs && chown -R node:node /app/logs
VOLUME ["/app/logs"]

# Скрипт для запуска
COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

# Переключаемся на непривилегированного пользователя
USER node

ENTRYPOINT ["./docker-entrypoint.sh"]

