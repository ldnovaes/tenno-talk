#!/usr/bin/env bash
# TENNO TALK daily backup (installed by provision.sh, run by /etc/cron.d/tenno-talk-backup).
# Only the "tenno" database and its media: the neighbours' data is never read here.
set -euo pipefail
# Quiet and predictable on any server: no forwarded locale, no inaccessible working directory.
export LANG=C.UTF-8 LC_ALL=C.UTF-8
cd /

BACKUP_DIR="${BACKUP_DIR:-/var/backups/tenno-talk}"
KEEP_DAYS="${KEEP_DAYS:-14}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_DIR/$stamp"
mkdir -p "$target"
chmod 700 "$BACKUP_DIR"

runuser -u postgres -- pg_dump --format=custom --no-owner tenno > "$target/db.dump"
tar -C /var/lib/tenno-talk -czf "$target/media.tar.gz" media

test -s "$target/db.dump"
pg_restore --list "$target/db.dump" > /dev/null

find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime "+$KEEP_DAYS" -exec rm -rf {} +
echo "$(date -u) backup ok: $target ($(du -sh "$target" | cut -f1))"
