#!/usr/bin/env bash
# Run this script on the home server only. Do not run on your dev machine.
# Usage: ./scripts/deploy.sh [branch]
# Default branch: main

set -e

BRANCH="${1:-main}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

echo "[deploy] Branch: $BRANCH"
echo "[deploy] Pulling latest..."
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "[deploy] Running migrations..."
docker compose run --rm web npx prisma migrate deploy

echo "[deploy] Rebuilding and starting containers..."
docker compose up -d --build

echo "[deploy] Done."
