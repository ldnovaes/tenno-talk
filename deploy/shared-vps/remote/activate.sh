#!/usr/bin/env bash
# Runs ON the VPS as root (./tenno run deploy:prod). Switches to release $1 and rolls back by
# itself if the backend does not become healthy. The site (static files) switches only after the
# backend is up, so the page and the API always match.
set -euo pipefail
# Quiet and predictable on any server: no forwarded locale, no inaccessible working directory.
export LANG=C.UTF-8 LC_ALL=C.UTF-8
cd /

SHA="${1:?usage: activate.sh <sha>}"
DOMAIN="${DOMAIN:?}"
PORT="${PORT:-8090}"
KEEP="${KEEP:-5}"
APP=/opt/tenno-talk
WEB=/var/www/tenno-talk
log() { echo "[activate] $*"; }

[ -f "$APP/releases/$SHA/app.jar" ] || { log "ERROR: $APP/releases/$SHA/app.jar missing"; exit 1; }
[ -f "$WEB/releases/$SHA/index.html" ] || { log "ERROR: $WEB/releases/$SHA/index.html missing"; exit 1; }

previous_app="$(readlink "$APP/current" 2>/dev/null || true)"
previous_web="$(readlink "$WEB/current" 2>/dev/null || true)"

healthy() {
  for _ in $(seq 1 60); do
    if curl -fsS --max-time 3 "http://127.0.0.1:$PORT/actuator/health" 2>/dev/null | grep -q '"UP"'; then return 0; fi
    sleep 2
  done
  return 1
}

chmod -R a+rX "$APP/releases/$SHA" "$WEB/releases/$SHA"
ln -sfn "$APP/releases/$SHA" "$APP/current"
log "Restarting the backend on $SHA"
systemctl restart tenno-talk

if ! healthy; then
  log "ERROR: backend not healthy. Recent log:"
  journalctl -u tenno-talk -n 60 --no-pager || true
  if [ -n "$previous_app" ]; then
    log "Rolling back to $previous_app"
    ln -sfn "$previous_app" "$APP/current"
    systemctl restart tenno-talk
    healthy && log "Previous release is serving again."
  else
    systemctl stop tenno-talk
  fi
  exit 1
fi

ln -sfn "$WEB/releases/$SHA" "$WEB/current"

# Through nginx, as a visitor would reach it.
page="$(curl -sk -o /dev/null -w '%{http_code}' -H "Host: $DOMAIN" https://127.0.0.1/welcome)"
api="$(curl -sk -o /dev/null -w '%{http_code}' -H "Host: $DOMAIN" https://127.0.0.1/api/auth/session)"
if [ "$page" != "200" ] || [ "$api" != "200" ]; then
  log "ERROR: through nginx page=$page api=$api. Rolling back."
  [ -n "$previous_web" ] && ln -sfn "$previous_web" "$WEB/current"
  if [ -n "$previous_app" ]; then ln -sfn "$previous_app" "$APP/current"; systemctl restart tenno-talk; fi
  exit 1
fi
log "Serving $SHA (page=$page api=$api)"

for dir in "$APP/releases" "$WEB/releases"; do
  (cd "$dir" && ls -1t | tail -n +$((KEEP + 1)) | xargs -r rm -rf)
done
