#!/bin/sh
set -e

# Use migrate deploy when migrations exist (production-safe), otherwise fall
# back to db push (prototyping / first deploy before any migration files exist).
if [ -d "./prisma/migrations" ] && [ "$(ls -A ./prisma/migrations)" ]; then
  echo "Applying Prisma migrations..."
  npx prisma migrate deploy
else
  echo "No migration files found — pushing schema with prisma db push..."
  npx prisma db push
fi

echo "Starting server..."
exec node dist/index.js
