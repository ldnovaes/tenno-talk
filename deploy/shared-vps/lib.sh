# Shared helpers for ./tenno (sourced). Reads the git-ignored deploy/shared-vps/vps.env.
SHARED_VPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# TENNO_VPS_ENV points to another settings file (e.g. a local rehearsal VM).
VPS_ENV_FILE="${TENNO_VPS_ENV:-$SHARED_VPS_DIR/vps.env}"
if [ ! -f "$VPS_ENV_FILE" ]; then
  echo "[tenno] Missing $VPS_ENV_FILE (copy deploy/shared-vps/vps.env.example and fill it in)." >&2
  exit 1
fi
# shellcheck source=/dev/null
source "$VPS_ENV_FILE"
: "${TENNO_VPS_HOST:?}" "${TENNO_VPS_PORT:=22}" "${TENNO_DOMAIN:?}" "${TENNO_CERT_EMAIL:=}" "${TENNO_PORT:=8090}"
: "${TENNO_NEIGHBOR_HOSTS:=}"
# Infisical project that holds the AI keys (PLAN.md §28.1). The project id is not a secret;
# the machine identity of that project (client id + secret) stays in the git-ignored vps.env.
: "${TENNO_INFISICAL_PROJECT_ID:=12c1b503-6d69-4fbe-a9a7-3601d35e2a7b}"

SSH_OPTS=(-p "$TENNO_VPS_PORT" -o ConnectTimeout=15 ${TENNO_SSH_EXTRA:-})

vps_ssh() { ssh "${SSH_OPTS[@]}" "$TENNO_VPS_HOST" "$@"; }
vps_rsync() { rsync -az --delete -e "ssh ${SSH_OPTS[*]}" "$1" "$TENNO_VPS_HOST:$2"; }

# KEY=VALUE lines of the Infisical machine identity for /etc/tenno-talk/tenno.env (sent on
# stdin to remote/set-env.sh). Fails early when vps.env does not have them.
infisical_env_lines() {
  if [ -z "${TENNO_INFISICAL_CLIENT_ID:-}" ] || [ -z "${TENNO_INFISICAL_CLIENT_SECRET:-}" ]; then
    echo "[tenno] Set TENNO_INFISICAL_CLIENT_ID and TENNO_INFISICAL_CLIENT_SECRET in $VPS_ENV_FILE" \
      "(Universal Auth of the tenno-talk project identity, see deploy/shared-vps/README.md)." >&2
    return 1
  fi
  printf 'INFISICAL_UNIVERSAL_AUTH_CLIENT_ID=%s\nINFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET=%s\nINFISICAL_PROJECT_ID=%s\n' \
    "$TENNO_INFISICAL_CLIENT_ID" "$TENNO_INFISICAL_CLIENT_SECRET" "$TENNO_INFISICAL_PROJECT_ID"
}

