#!/usr/bin/env bash
# Run this on the home server only (e.g. from cron). Do not run on your dev machine.
# Fetches origin/main and runs deploy only if main has changed.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

git fetch origin main

if [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ]; then
  exit 0
fi

exec "$SCRIPT_DIR/deploy-k8s.sh" main

# */5 * * * * /path/to/SarussiWare/scripts/poll-and-deploy.sh
