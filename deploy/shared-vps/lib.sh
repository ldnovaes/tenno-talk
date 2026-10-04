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

SSH_OPTS=(-p "$TENNO_VPS_PORT" -o ConnectTimeout=15 ${TENNO_SSH_EXTRA:-})

vps_ssh() { ssh "${SSH_OPTS[@]}" "$TENNO_VPS_HOST" "$@"; }
vps_rsync() { rsync -az --delete -e "ssh ${SSH_OPTS[*]}" "$1" "$TENNO_VPS_HOST:$2"; }
