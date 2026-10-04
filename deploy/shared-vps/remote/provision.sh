#!/usr/bin/env bash
# Runs ON the VPS as root (./tenno vps provision copies it there). Idempotent: safe to re-run.
# Prepares TENNO TALK next to other sites without changing them:
#   system user, folders, Node + AI CLIs (inside /opt/tenno-talk), database and role in the
#   existing PostgreSQL, systemd unit, its own TLS certificate and its own nginx file.
#
# Env: DOMAIN, CERT_EMAIL, PORT (backend, 127.0.0.1 only), NEIGHBOR_HOSTS (sites whose answers
# must not change), CERT_MODE=letsencrypt|selfsigned (selfsigned only for rehearsals).
set -euo pipefail
# Quiet and predictable on any server: no forwarded locale, no inaccessible working directory.
export LANG=C.UTF-8 LC_ALL=C.UTF-8
cd /

DOMAIN="${DOMAIN:?}"
CERT_EMAIL="${CERT_EMAIL:?}"
PORT="${PORT:-8090}"
CERT_MODE="${CERT_MODE:-letsencrypt}"
NEIGHBOR_HOSTS="${NEIGHBOR_HOSTS:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"

APP=/opt/tenno-talk
WEB=/var/www/tenno-talk
DATA=/var/lib/tenno-talk
CONF=/etc/tenno-talk
ENV_FILE="$CONF/tenno.env"
SITE=/etc/nginx/sites-available/tenno-talk.conf
SNIPPET=/etc/nginx/snippets/tenno-talk-headers.conf

log() { echo "[provision] $*"; }
as_postgres() { runuser -u postgres -- "$@"; }
psql_q() { as_postgres psql -v ON_ERROR_STOP=1 -tAc "$1"; }

# ---------------------------------------------------------------- user and folders
if ! id tenno >/dev/null 2>&1; then
  log "Creating system user tenno"
  useradd --system --home-dir "$DATA" --create-home --shell /usr/sbin/nologin tenno
fi
install -d -o tenno -g tenno -m 750 "$DATA" "$DATA/media"
install -d -o root -g root -m 755 "$APP" "$APP/releases" "$APP/bin" "$WEB" "$WEB/releases"
install -d -o root -g tenno -m 750 "$CONF"
install -d -o root -g root -m 700 /var/backups/tenno-talk

# ---------------------------------------------------------------- Node + AI CLIs (no system packages)
if ! "$APP/node/bin/node" --version 2>/dev/null | grep -q '^v22\.'; then
  log "Installing Node 22 into $APP/node"
  tmp="$(mktemp -d)"
  base="https://nodejs.org/dist/latest-v22.x"
  curl -fsSL "$base/SHASUMS256.txt" -o "$tmp/SHASUMS256.txt"
  file="$(grep -o 'node-v22[^ ]*-linux-x64.tar.xz' "$tmp/SHASUMS256.txt" | head -1)"
  curl -fsSL "$base/$file" -o "$tmp/$file"
  (cd "$tmp" && grep " $file\$" SHASUMS256.txt | sha256sum -c -)
  rm -rf "$APP/node" && mkdir -p "$APP/node"
  tar -xJf "$tmp/$file" -C "$APP/node" --strip-components=1
  rm -rf "$tmp"
fi
log "Installing/updating the AI CLIs (codex, claude)"
PATH="$APP/node/bin:$PATH" npm install -g --silent --no-fund --no-audit --prefix "$APP/cli" @openai/codex @anthropic-ai/claude-code
# Each check on its own line: inside "a && b", set -e would ignore a failure of a.
PATH="$APP/node/bin:$PATH" "$APP/cli/bin/codex" --version >/dev/null
PATH="$APP/node/bin:$PATH" "$APP/cli/bin/claude" --version >/dev/null

# ---------------------------------------------------------------- database
if [ ! -f "$ENV_FILE" ]; then
  log "Creating $ENV_FILE (new database password)"
  password="$(openssl rand -hex 24)"
  umask 027
  cat > "$ENV_FILE" <<ENV
# TENNO TALK runtime configuration (root:tenno 640). Not in git.
DATABASE_URL=jdbc:postgresql://127.0.0.1:5432/tenno
DATABASE_USER=tenno
DATABASE_PASSWORD=$password
SERVER_ADDRESS=127.0.0.1
SERVER_PORT=$PORT
PUBLIC_URL=https://$DOMAIN
COOKIE_SECURE=true
MEDIA_ROOT=$DATA/media
MAX_UPLOAD_SIZE=500MB
# Social login (optional): leave blank and the button is not shown.
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
ENV
  chown root:tenno "$ENV_FILE"
  chmod 640 "$ENV_FILE"
fi
db_password="$(grep '^DATABASE_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"

if [ "$(psql_q "select 1 from pg_roles where rolname = 'tenno'")" != "1" ]; then
  log "Creating PostgreSQL role tenno"
  psql_q "create role tenno login password '$db_password'"
else
  psql_q "alter role tenno password '$db_password'" >/dev/null
fi
if [ "$(psql_q "select 1 from pg_database where datname = 'tenno'")" != "1" ]; then
  log "Creating database tenno"
  as_postgres createdb --owner=tenno tenno
fi
# Isolation: no database of the neighbours accepts a connection from roles that don't own it.
# Owners and superusers keep their access (owners hold every privilege on what they own).
for db in $(psql_q "select datname from pg_database where not datistemplate and datname not in ('postgres', 'tenno')"); do
  if [ "$(psql_q "select has_database_privilege('tenno', '$db', 'connect')")" = "t" ]; then
    owner="$(psql_q "select pg_get_userbyid(datdba) from pg_database where datname = '$db'")"
    log "Revoking public CONNECT on $db (owner $owner keeps access)"
    psql_q "revoke connect on database \"$db\" from public" >/dev/null
  fi
done

# ---------------------------------------------------------------- systemd
install -o root -g root -m 644 "$HERE/tenno-talk.service" /etc/systemd/system/tenno-talk.service
install -o root -g root -m 755 "$HERE/backup.sh" "$APP/bin/backup.sh"
systemctl daemon-reload
systemctl enable tenno-talk >/dev/null 2>&1

# ---------------------------------------------------------------- daily backup
cat > /etc/cron.d/tenno-talk-backup <<CRON
# TENNO TALK: database + media, kept 14 days in /var/backups/tenno-talk (copy it off the VPS too).
30 3 * * * root $APP/bin/backup.sh >> /var/log/tenno-talk-backup.log 2>&1
CRON
chmod 644 /etc/cron.d/tenno-talk-backup

# ---------------------------------------------------------------- certificate (never touches nginx config)
live="/etc/letsencrypt/live/$DOMAIN"
if [ ! -s "$live/fullchain.pem" ]; then
  if [ "$CERT_MODE" = "selfsigned" ]; then
    log "Rehearsal: self-signed certificate for $DOMAIN"
    mkdir -p "$live"
    openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj "/CN=$DOMAIN" \
      -keyout "$live/privkey.pem" -out "$live/fullchain.pem" 2>/dev/null
  else
    # HTTP-01 through the webroot the neighbours' port-80 block already serves for this name.
    probe="tenno-probe-$RANDOM"
    mkdir -p /var/www/certbot-webroot/.well-known/acme-challenge
    echo ok > "/var/www/certbot-webroot/.well-known/acme-challenge/$probe"
    got="$(curl -s -H "Host: $DOMAIN" "http://127.0.0.1/.well-known/acme-challenge/$probe" || true)"
    rm -f "/var/www/certbot-webroot/.well-known/acme-challenge/$probe"
    [ "$got" = "ok" ] || { log "ERROR: http://$DOMAIN/.well-known/acme-challenge/ is not served from /var/www/certbot-webroot"; exit 1; }
    log "Requesting a Let's Encrypt certificate for $DOMAIN (certonly: nginx config untouched)"
    certbot certonly --webroot -w /var/www/certbot-webroot --cert-name "$DOMAIN" -d "$DOMAIN" \
      --non-interactive --agree-tos -m "$CERT_EMAIL" --deploy-hook "systemctl reload nginx"
  fi
fi

# ---------------------------------------------------------------- nginx (carefully)
probe_neighbors() {
  for host in $NEIGHBOR_HOSTS; do
    for scheme in http https; do
      printf '%s://%s=%s ' "$scheme" "$host" \
        "$(curl -sk -o /dev/null -w '%{http_code}' --max-time 10 -H "Host: $host" "$scheme://127.0.0.1/" || echo 000)"
    done
  done
}

render() {
  sed -e "s/__DOMAIN__/$DOMAIN/g" -e "s/__PORT__/$PORT/g" "$1"
}

before="$(probe_neighbors)"
log "Neighbours before: $before"

backup_dir="$(mktemp -d)"
[ -f "$SITE" ] && cp -a "$SITE" "$backup_dir/site"
[ -f "$SNIPPET" ] && cp -a "$SNIPPET" "$backup_dir/snippet"
had_link=false; [ -L /etc/nginx/sites-enabled/tenno-talk.conf ] && had_link=true

restore_nginx() {
  log "Restoring the previous nginx state"
  if [ -f "$backup_dir/site" ]; then cp -a "$backup_dir/site" "$SITE"; else rm -f "$SITE"; fi
  if [ -f "$backup_dir/snippet" ]; then cp -a "$backup_dir/snippet" "$SNIPPET"; else rm -f "$SNIPPET"; fi
  $had_link || rm -f /etc/nginx/sites-enabled/tenno-talk.conf
}

mkdir -p /etc/nginx/snippets
render "$HERE/tenno-talk-headers.conf.template" > "$SNIPPET"
render "$HERE/nginx-tenno.conf.template" > "$SITE"
ln -sfn "$SITE" /etc/nginx/sites-enabled/tenno-talk.conf

# 1) Validate the whole configuration. Nothing has been applied yet: on failure, the running
#    nginx never saw these files.
if ! nginx -t 2>"$backup_dir/nginx-t.log"; then
  cat "$backup_dir/nginx-t.log" >&2
  restore_nginx
  nginx -t >/dev/null 2>&1 && log "Previous configuration intact, nothing reloaded."
  exit 1
fi

# 2) Graceful reload (never restart): old workers finish their requests; if the reload were
#    refused, the old configuration keeps serving.
systemctl reload nginx
sleep 2

# 3) The neighbours must answer exactly as before.
after="$(probe_neighbors)"
log "Neighbours after:  $after"
if [ "$before" != "$after" ]; then
  log "ERROR: a neighbour changed its answer. Rolling back."
  restore_nginx
  nginx -t && systemctl reload nginx
  exit 1
fi
rm -rf "$backup_dir"
log "nginx ready for https://$DOMAIN (neighbours unchanged)"
log "Done. Next: ./tenno run deploy:prod"
