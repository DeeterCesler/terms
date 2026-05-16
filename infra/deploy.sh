#!/bin/bash
# Run from ~/app on the server to deploy the latest version.
# Usage: bash infra/deploy.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

echo "==> Pulling latest code"
git pull origin main

echo "==> Installing dependencies"
npm install --omit=dev

echo "==> Running migrations"
npm run migrate

echo "==> Building and restarting containers"
docker compose -f docker-compose.yml -f infra/docker-compose.prod.yml \
  up -d --build --remove-orphans api

echo "==> Cleaning up old images"
docker image prune -f

echo "==> Done. API status:"
docker compose ps api
