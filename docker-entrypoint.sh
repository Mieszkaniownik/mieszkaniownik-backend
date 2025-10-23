#!/bin/sh
set -e

echo "Starting Mieszkaniownik Backend..."

echo "Waiting for PostgreSQL..."
until nc -z ${POSTGRES_HOST:-postgres} ${POSTGRES_PORT:-5432}; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done
echo "PostgreSQL is up"

echo "Waiting for Redis..."
until nc -z ${REDIS_HOST:-redis} ${REDIS_PORT:-6379}; do
  echo "Redis is unavailable - sleeping"
  sleep 1
done
echo "Redis is up"

echo "Running database migrations..."
npx prisma migrate deploy

if [ "$RUN_SEED" = "true" ] || [ "$NODE_ENV" = "development" ]; then
  echo "Seeding database..."
  npx prisma db seed || echo "Seeding failed or already seeded"
fi

echo "Database ready!"

echo "Generating Prisma Client..."
npx prisma generate

echo "Starting application..."
exec "$@"
