#!/usr/bin/env bash
# Restores a backup made by backup.sh:  deploy/restore.sh /var/backups/tenno-talk/<stamp>
# Stops the backend, replaces the database and the media, starts it again.
set -euo pipefail

cd "$(dirname "$0")"
source_dir="${1:?usage: restore.sh <backup directory>}"
COMPOSE="docker compose -f docker-compose.yml"
test -s "$source_dir/db.dump"

read -r -p "This replaces the current database and media with $source_dir. Type RESTORE to continue: " answer
[ "$answer" = "RESTORE" ] || { echo "Cancelled."; exit 1; }

$COMPOSE stop backend
$COMPOSE exec -T postgres dropdb -U tenno --if-exists tenno
$COMPOSE exec -T postgres createdb -U tenno tenno
$COMPOSE exec -T postgres pg_restore -U tenno -d tenno --no-owner --exit-on-error < "$source_dir/db.dump"
if [ -s "$source_dir/media.tar.gz" ]; then
  $COMPOSE run --rm --no-deps -T --entrypoint sh backend -c 'rm -rf /data/media/* && tar -C /data -xzf -' < "$source_dir/media.tar.gz"
fi
$COMPOSE start backend
echo "Restored from $source_dir."
