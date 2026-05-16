#!/bin/sh
set -e

echo "Running migrations..."
node packages/api/dist/migrate.js

echo "Starting API..."
exec node packages/api/dist/index.js
