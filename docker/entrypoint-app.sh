#!/bin/sh
set -e

if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "[app] prisma migrate deploy"
  ./node_modules/.bin/prisma migrate deploy
  echo "[app] room exclusion constraint (idempotent)"
  ./node_modules/.bin/prisma db execute --file prisma/sql/room-exclusion.sql --schema prisma/schema.prisma
fi

exec node server.js
