#!/bin/sh
set -e

# Ожидаем доступности БД с помощью wait4x
if [ -n "$DATABASE_URL" ]; then
  echo "Waiting for PostgreSQL to be ready..."
  wait4x postgresql "$DATABASE_URL" --timeout 60s
fi

# Применяем миграции
if [ "$SKIP_MIGRATIONS" != "true" ]; then
  echo "Running database migrations..."
  npx prisma migrate deploy
fi

# Запускаем приложение
exec node --max-old-space-size=4096 dist/bot.js