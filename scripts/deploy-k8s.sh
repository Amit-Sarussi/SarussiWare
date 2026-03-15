#!/usr/bin/env bash
# Run this on the home server only (Kubernetes). Do not run on your dev machine.
# Requires: docker, kubectl, REGISTRY env (e.g. localhost:5000 or your-registry:5000)
# Usage: ./scripts/deploy-k8s.sh [branch]
# Default branch: main

set -e

BRANCH="${1:-main}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NAMESPACE=sarussiware

if [ -z "${REGISTRY}" ]; then
  echo "REGISTRY must be set (e.g. localhost:5000 or registry.example.com)" >&2
  exit 1
fi

cd "$REPO_ROOT"

echo "[deploy-k8s] Branch: $BRANCH"
echo "[deploy-k8s] Pulling latest..."
git checkout "$BRANCH"
git pull origin "$BRANCH"

TAG="$(git rev-parse --short HEAD)"
IMAGE="${REGISTRY}/sarussiware-web:${TAG}"
export IMAGE TAG

echo "[deploy-k8s] Building image $IMAGE..."
docker build -t "$IMAGE" ./app

echo "[deploy-k8s] Pushing image..."
docker push "$IMAGE"

echo "[deploy-k8s] Applying base manifests..."
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/postgres-configmap.yaml
kubectl apply -f k8s/postgres-secret.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/app-service.yaml

echo "[deploy-k8s] Waiting for Postgres to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres -n "$NAMESPACE" --timeout=300s 2>/dev/null || true

echo "[deploy-k8s] Running migrations..."
envsubst < k8s/migrate-job.yaml | kubectl apply -f -
kubectl wait --for=condition=complete "job/migrate-${TAG}" -n "$NAMESPACE" --timeout=300s

echo "[deploy-k8s] Deploying app..."
envsubst < k8s/app-deployment.yaml | kubectl apply -f -
kubectl rollout status deployment/web -n "$NAMESPACE" --timeout=120s

echo "[deploy-k8s] Done."
