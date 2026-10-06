#!/usr/bin/env bash
# Runs ON the VPS as root (./tenno vps provision copies it there). Idempotent: safe to re-run.
# Prepares TENNO TALK next to other sites without changing them:
#   system user, folders, the Infisical CLI (AI keys), database and role in the
#   existing PostgreSQL, systemd unit, its own TLS certificate and its own nginx file.
#
# Env: DOMAIN, CERT_EMAIL, PORT (backend, 127.0.0.1 only), NEIGHBOR_HOSTS (sites whose answers
# must not change), CERT_MODE=letsencrypt|selfsigned (selfsigned only for rehearsals).
set -euo pipefail
# Quiet and predictable on any server: no forwarded locale, no inaccessible working directory.
export LANG=C.UTF-8 LC_ALL=C.UTF-8
cd /

DOMAIN="${DOMAIN:?}"
# Optional: without it, the Let's Encrypt account already registered on the server is reused.
CERT_EMAIL="${CERT_EMAIL:-}"
PORT="${PORT:-8090}"
CERT_MODE="${CERT_MODE:-letsencrypt}"
NEIGHBOR_HOSTS="${NEIGHBOR_HOSTS:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
# Runtime secrets arrive on stdin (./tenno vps provision); read them before any
# other command can consume stdin.
IDENTITY=""
[ -t 0 ] || IDENTITY="$(cat)"

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

# ---------------------------------------------------------------- Infisical CLI (AI keys, PLAN.md §28.1)
# Same CLI the neighbours' backend uses; installed once from the Infisical apt repository.
if ! command -v infisical >/dev/null 2>&1; then
  log "Installing the Infisical CLI"
  curl -1sLf 'https://artifacts-cli.infisical.com/setup.deb.sh' | bash
  apt-get install -y infisical
fi

# ---------------------------------------------------------------- database
if [ ! -f "$ENV_FILE" ]; then
  log "Creating $ENV_FILE (new database password)"
  password="$(openssl rand -hex 24)"
  # Restrictive umask only for this file (a script-wide umask would leak into the shared
  # certbot webroot and the nginx files created later).
  ( umask 077
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
MAX_UPLOAD_SIZE=100MB
# Infisical machine identity of the tenno-talk project: it brings OPENAI_API_KEY / ANTHROPIC_API_KEY
# into the process (tenno-talk.service). Written by set-env.sh from the local vps.env.
INFISICAL_UNIVERSAL_AUTH_CLIENT_ID=
INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET=
INFISICAL_PROJECT_ID=
# Social login (optional): leave blank and the button is not shown.
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
ENV
  )
  chown root:tenno "$ENV_FILE"
  chmod 640 "$ENV_FILE"
fi
# 2026-10-06 (PLAN.md §38): files are capped at 100 MB; older env files said 500MB.
sed -i 's/^MAX_UPLOAD_SIZE=500MB$/MAX_UPLOAD_SIZE=100MB/' "$ENV_FILE"
# Infisical identity for the AI keys (tenno-talk project).
[ -z "$IDENTITY" ] || bash "$HERE/set-env.sh" "$ENV_FILE" <<<"$IDENTITY"
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
# The service starts through Infisical: without the identity it could not start, and a deploy
# would roll back to a release that cannot start either. Stop here instead.
missing=""
for var in INFISICAL_UNIVERSAL_AUTH_CLIENT_ID INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET INFISICAL_PROJECT_ID; do
  grep -q "^$var=." "$ENV_FILE" || missing="$missing $var"
done
if [ -n "$missing" ]; then
  log "ERROR:$missing missing in $ENV_FILE. Set TENNO_INFISICAL_CLIENT_ID/_SECRET in vps.env and run ./tenno vps provision again."
  exit 1
fi
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
    # The webroot is shared: leave it exactly as found (certbot creates its own folders).
    webroot=/var/www/certbot-webroot
    created_well_known=false
    [ -d "$webroot/.well-known" ] || created_well_known=true
    install -d -m 755 "$webroot/.well-known" "$webroot/.well-known/acme-challenge"
    probe="tenno-probe-$RANDOM"
    echo ok > "$webroot/.well-known/acme-challenge/$probe"
    chmod 644 "$webroot/.well-known/acme-challenge/$probe"
    got="$(curl -s -H "Host: $DOMAIN" "http://127.0.0.1/.well-known/acme-challenge/$probe" || true)"
    rm -f "$webroot/.well-known/acme-challenge/$probe"
    if $created_well_known; then rm -rf "$webroot/.well-known"; fi
    [ "$got" = "ok" ] || { log "ERROR: http://$DOMAIN/.well-known/acme-challenge/ is not served from /var/www/certbot-webroot"; exit 1; }
    log "Requesting a Let's Encrypt certificate for $DOMAIN (certonly: nginx config untouched)"
    email_args=()
    if [ -n "$CERT_EMAIL" ]; then
      email_args=(-m "$CERT_EMAIL")
    elif ! ls /etc/letsencrypt/accounts/acme-v02.api.letsencrypt.org/directory/*/regr.json >/dev/null 2>&1; then
      log "ERROR: no Let's Encrypt account on this server; set TENNO_CERT_EMAIL"; exit 1
    fi
    certbot certonly --webroot -w /var/www/certbot-webroot --cert-name "$DOMAIN" -d "$DOMAIN" \
      --non-interactive --agree-tos "${email_args[@]}" --deploy-hook "systemctl reload nginx"
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
chmod 644 "$SNIPPET" "$SITE"
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
