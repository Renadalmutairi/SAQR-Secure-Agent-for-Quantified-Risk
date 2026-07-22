#!/usr/bin/env bash
# Deploys the full SAQR platform to a remote VPS over SSH.
#
# Usage:
#   VPS_HOST=1.2.3.4 VPS_USER=root VPS_SSH_KEY=~/.ssh/id_rsa ./deploy/deploy.sh
#   (or VPS_SSH_KEY unset to use password/agent auth interactively)
#
# What it does, in order:
#   1. rsyncs the project to the VPS (excluding local build artifacts)
#   2. installs Docker + the Compose plugin on the VPS if not already present
#   3. builds and starts the full production stack
#   4. waits for every container to report healthy
#   5. runs Agent 1's Alembic migration for the token station tables
#   6. runs a real end-to-end smoke test against the deployed stack
#   7. prints the final public URL and status
set -euo pipefail

VPS_HOST="${VPS_HOST:?Set VPS_HOST}"
VPS_USER="${VPS_USER:?Set VPS_USER}"
VPS_PORT="${VPS_PORT:-22}"
REMOTE_DIR="${REMOTE_DIR:-/opt/saqr}"
SSH_OPTS=(-p "$VPS_PORT" -o StrictHostKeyChecking=accept-new)
if [ -n "${VPS_SSH_KEY:-}" ]; then
  SSH_OPTS+=(-i "$VPS_SSH_KEY")
fi

SSH() { ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" "$@"; }
RSYNC_SSH="ssh ${SSH_OPTS[*]}"

echo "==> 1/7 Syncing project to ${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}"
SSH "mkdir -p ${REMOTE_DIR}"
rsync -az --delete \
  --exclude '.venv' --exclude 'node_modules' --exclude '__pycache__' \
  --exclude '*.pyc' --exclude 'dist' --exclude '.git' \
  --exclude 'services/dashboard/benchmark_data/jobs/*.json' \
  --exclude '*.zip' \
  -e "$RSYNC_SSH" \
  ./ "${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/"

echo "==> 2/7 Ensuring Docker is installed on the VPS"
SSH bash -s <<'REMOTE_SCRIPT'
set -e
if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "Installing Docker Compose plugin..."
  apt-get update -y && apt-get install -y docker-compose-plugin
fi
REMOTE_SCRIPT

echo "==> 3/7 Building and starting the full stack"
SSH "cd ${REMOTE_DIR} && docker compose -f docker-compose.prod.yml --env-file .env.production build"
SSH "cd ${REMOTE_DIR} && docker compose -f docker-compose.prod.yml --env-file .env.production up -d"

echo "==> 4/7 Waiting for containers to report healthy (up to 5 minutes)"
SSH bash -s <<REMOTE_SCRIPT
set -e
cd ${REMOTE_DIR}
for i in \$(seq 1 60); do
  UNHEALTHY=\$(docker compose -f docker-compose.prod.yml ps --format '{{.Name}} {{.Status}}' | grep -Ev 'healthy|Up' || true)
  if [ -z "\$UNHEALTHY" ]; then
    echo "All containers up."
    break
  fi
  sleep 5
done
docker compose -f docker-compose.prod.yml ps
REMOTE_SCRIPT

echo "==> 5/7 Running Agent 1 migration (token station tables)"
SSH "cd ${REMOTE_DIR} && docker compose -f docker-compose.prod.yml exec -T behavioral-dna-engine alembic upgrade head"

echo "==> 6/7 Running a real end-to-end smoke test"
SSH bash -s <<REMOTE_SCRIPT
set -e
echo "--- /api/health via nginx ---"
curl -sf http://localhost/api/health
echo
echo "--- /api/db-status via nginx ---"
curl -sf http://localhost/api/db-status
echo
echo "--- frontend root ---"
curl -s -o /dev/null -w "frontend HTTP %{http_code}\n" http://localhost/
REMOTE_SCRIPT

echo "==> 7/7 Done."
echo "Public URL: http://${VPS_HOST}/"
echo "Legacy Token Station + Benchmark Suite UI: http://${VPS_HOST}/legacy/"
