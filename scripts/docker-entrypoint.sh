#!/bin/sh
set -e

echo "Waiting for MySQL at $DB_HOST:$DB_PORT..."
until mysqladmin ping -h "$DB_HOST" -P "$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" --silent; do
  printf '.'
  sleep 1
done

printf "\nRunning migrations...\n"
npm run migrate

echo "Starting backend"
npm run start
