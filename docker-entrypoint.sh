#!/bin/sh
set -e

if [ -d "/app/host-src" ]; then
  echo "[Entrypoint] Copying host source and repositories into container..."
  rm -rf /app/src
  cp -R /app/host-src /app/src
fi

if [ -d "/app/host-prisma" ]; then
  echo "[Entrypoint] Copying host Prisma schema and migrations into container..."
  rm -rf /app/prisma
  cp -R /app/host-prisma /app/prisma
fi

echo "[Entrypoint] Generating Prisma Client and building TypeScript..."
npx prisma generate
npm run build

echo "[Entrypoint] Bootstrapping SQL Server database..."
npm run prisma:bootstrap

echo "[Entrypoint] Applying database schema..."
npx prisma db push --skip-generate

echo "[Entrypoint] Seeding initial RBAC data..."
npm run prisma:seed

echo "[Entrypoint] Starting RBAC Science Portal API..."
exec "$@"
