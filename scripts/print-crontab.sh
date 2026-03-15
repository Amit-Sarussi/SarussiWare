#!/usr/bin/env bash
# Run this on the server. Prints the crontab line for auto-deploy.
# Usage: export REGISTRY=localhost:5000; ./scripts/print-crontab.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -z "${REGISTRY}" ]; then
  echo "Set REGISTRY first, e.g. export REGISTRY=localhost:5000" >&2
  exit 1
fi

echo "# Add this line to crontab (crontab -e):"
echo "*/5 * * * * export REGISTRY=${REGISTRY}; ${REPO_ROOT}/scripts/poll-and-deploy.sh"
