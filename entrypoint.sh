#!/bin/bash
set -e

echo "Starting application..."

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set"
  exit 1
fi

echo "Checking environment variables..."
if node dist/env-check.mjs; then
  echo "Environment OK"
else
  echo "Environment check failed"
  exit 1
fi

echo "Waiting for database connection..."
max_attempts=30
attempt=0

until node --input-type=module -e "import pg from 'pg'; const client = new pg.Client({ connectionString: process.env.DATABASE_URL }); await client.connect(); await client.query('SELECT 1'); await client.end()" >/dev/null 2>&1 || [ "$attempt" -eq "$max_attempts" ]; do
  attempt=$((attempt + 1))
  if [ $((attempt % 5)) -eq 0 ] || [ "$attempt" -eq "$max_attempts" ]; then
    echo "   Attempt $attempt/$max_attempts..."
  fi
  if [ "$attempt" -lt "$max_attempts" ]; then
    sleep 2
  fi
done

if [ "$attempt" -eq "$max_attempts" ]; then
  echo "Could not connect to database after $max_attempts attempts"
  exit 1
fi

echo "Database connected"
echo "Starting Node.js server..."
exec node dist/server/entry.mjs
