#!/usr/bin/env bash
# Runs ON the VPS as root: ./tenno vps provision and ./tenno run deploy:prod call it.
# Reads KEY=VALUE lines on stdin (never on a command line, so they don't show in `ps`) and sets
# them in the env file, keeping every other line and its root:tenno 640 mode. Only the keys of
# the Infisical machine identity (tenno-talk project) are accepted.
set -euo pipefail
ENV_FILE="$1"
[ -f "$ENV_FILE" ] || { echo "[set-env] $ENV_FILE is missing: run ./tenno vps provision first." >&2; exit 1; }

tmp="$(mktemp "$ENV_FILE.XXXXXX")"
trap 'rm -f "$tmp" "$tmp.next"' EXIT
cp "$ENV_FILE" "$tmp"
while IFS= read -r line; do
  [ -n "$line" ] || continue
  key="${line%%=*}"
  value="${line#*=}"
  case "$key" in
    INFISICAL_UNIVERSAL_AUTH_CLIENT_ID|INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET|INFISICAL_PROJECT_ID) ;;
    *) echo "[set-env] Refusing to set $key." >&2; exit 1 ;;
  esac
  [[ "$value" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "[set-env] Invalid value for $key." >&2; exit 1; }
  grep -v "^$key=" "$tmp" > "$tmp.next" || true
  echo "$key=$value" >> "$tmp.next"
  mv "$tmp.next" "$tmp"
done
chown root:tenno "$tmp"
chmod 640 "$tmp"
if cmp -s "$tmp" "$ENV_FILE"; then
  echo "[set-env] Infisical identity already up to date."
else
  mv "$tmp" "$ENV_FILE"
  echo "[set-env] Infisical identity written to $ENV_FILE."
fi
