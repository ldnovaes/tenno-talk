#!/usr/bin/env bash
# ./tenno run deploy:prod — runs the tests, builds locally and ships the release to the shared VPS.
# Nothing is compiled on the VPS (it serves other people's sites too). Never ships uncommitted
# code or a build whose tests failed (unless --skip-tests).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/deploy/shared-vps/lib.sh"
SKIP_TESTS="${SKIP_TESTS:-false}"

# --- (a) clean tree ---
if [ -n "$(git -C "$ROOT_DIR" status --porcelain)" ]; then
  echo "[deploy] ERROR: working tree not clean. Commit or stash changes first." >&2
  exit 1
fi
SHA="$(git -C "$ROOT_DIR" rev-parse --short HEAD)"
echo "[deploy] Deploying $SHA to https://$TENNO_DOMAIN"

# --- (b) tests ---
if [ "$SKIP_TESTS" = "true" ]; then
  echo "[deploy] Skipping tests (--skip-tests)."
else
  echo "[deploy] Frontend checks..."
  (cd "$ROOT_DIR" && bun install --frozen-lockfile && bun run lint && bun run typecheck && bun run test)
  echo "[deploy] Backend tests on PostgreSQL 14 (the version on the VPS)..."
  (cd "$ROOT_DIR/backend" && ./mvnw -q -B test -Dtenno.postgres=14)
  echo "[deploy] End-to-end tests..."
  (cd "$ROOT_DIR" && bun run e2e)
fi

# --- (c) build ---
echo "[deploy] Building the site (real backend)..."
(cd "$ROOT_DIR" && VITE_DATA_SOURCE=http bun run build)
[ -f "$ROOT_DIR/dist/index.html" ] || { echo "[deploy] ERROR: dist/index.html missing" >&2; exit 1; }
echo "[deploy] Building the backend..."
(cd "$ROOT_DIR/backend" && ./mvnw -q -B -DskipTests package)
JAR="$(find "$ROOT_DIR/backend/target" -maxdepth 1 -name 'tenno-talk-backend-*.jar' ! -name '*.original' | head -1)"
[ -n "$JAR" ] || { echo "[deploy] ERROR: backend jar missing" >&2; exit 1; }

# --- (d) transfer ---
echo "[deploy] Transferring release $SHA..."
vps_ssh "mkdir -p /opt/tenno-talk/releases/$SHA /var/www/tenno-talk/releases/$SHA"
vps_rsync "$ROOT_DIR/dist/" "/var/www/tenno-talk/releases/$SHA/"
vps_rsync "$JAR" "/opt/tenno-talk/releases/$SHA/app.jar"
vps_rsync "$ROOT_DIR/deploy/shared-vps/remote/activate.sh" "/opt/tenno-talk/bin/activate.sh"

# --- (e) activate (health check + automatic rollback on the VPS) ---
vps_ssh "DOMAIN='$TENNO_DOMAIN' PORT='$TENNO_PORT' bash /opt/tenno-talk/bin/activate.sh '$SHA'"
echo "[deploy] Done: https://$TENNO_DOMAIN is serving $SHA."
