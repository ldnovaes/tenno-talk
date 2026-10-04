#!/usr/bin/env bash
# Daily backup (PLAN.md §31): PostgreSQL dump + media files, kept for $KEEP_DAYS days.
# Run from cron on the VPS:  15 3 * * *  /opt/tenno-talk/deploy/backup.sh >> /var/log/tenno-backup.log 2>&1
# Copy $BACKUP_DIR off the VPS as well (rclone, rsync…): a backup on the same disk is not a backup.
set -euo pipefail

cd "$(dirname "$0")"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/tenno-talk}"
KEEP_DAYS="${KEEP_DAYS:-14}"
COMPOSE="docker compose -f docker-compose.yml"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_DIR/$stamp"
mkdir -p "$target"

# Consistent snapshot without stopping the app; custom format restores with pg_restore.
$COMPOSE exec -T postgres pg_dump -U tenno -d tenno --format=custom --no-owner > "$target/db.dump"

# Media volume, read through the backend container (it owns /data/media).
$COMPOSE exec -T backend tar -C /data -czf - media > "$target/media.tar.gz"

# Fail loudly on an empty or unreadable dump.
test -s "$target/db.dump"
$COMPOSE exec -T postgres pg_restore --list < "$target/db.dump" > /dev/null

find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime "+$KEEP_DAYS" -exec rm -rf {} +
echo "$(date -u) backup ok: $target ($(du -sh "$target" | cut -f1))"
