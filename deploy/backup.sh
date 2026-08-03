#!/usr/bin/env bash
#
# Nightly database backup, and the restore that proves it.
#
# A backup nobody has restored is a hypothesis. `--verify` takes the newest
# dump, restores it into a scratch database inside the same Postgres container,
# counts the rows, and throws the scratch database away — so the thing being
# trusted has actually been exercised.
#
#   deploy/backup.sh              take a backup
#   deploy/backup.sh --verify     take one, then restore it and count rows
#
# Install as a cron job on the VPS:
#   0 3 * * * cd /opt/lao && deploy/backup.sh >> /var/log/lao-backup.log 2>&1
set -euo pipefail

COMPOSE="docker compose -f deploy/docker-compose.prod.yml"
BACKUP_DIR="${BACKUP_DIR:-/opt/lao/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/lao-$STAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[backup] dumping to $FILE"
$COMPOSE exec -T postgres pg_dump -U lao -d lao --clean --if-exists | gzip -9 > "$FILE"

SIZE=$(stat -c%s "$FILE" 2>/dev/null || stat -f%z "$FILE")
# A dump of a live database is never this small. Catching it here means the
# failure surfaces now rather than on the night it is needed.
if [ "$SIZE" -lt 1024 ]; then
  echo "[backup] FAILED: dump is only ${SIZE} bytes" >&2
  rm -f "$FILE"
  exit 1
fi
echo "[backup] ok — $(numfmt --to=iec "$SIZE" 2>/dev/null || echo "$SIZE bytes")"

if [ "${1:-}" = "--verify" ]; then
  echo "[backup] verifying by restoring into a scratch database"
  $COMPOSE exec -T postgres psql -U lao -d postgres -c 'DROP DATABASE IF EXISTS lao_verify;' >/dev/null
  $COMPOSE exec -T postgres psql -U lao -d postgres -c 'CREATE DATABASE lao_verify;' >/dev/null
  gunzip -c "$FILE" | $COMPOSE exec -T postgres psql -U lao -d lao_verify >/dev/null 2>&1

  USERS=$($COMPOSE exec -T postgres psql -U lao -d lao_verify -tAc 'SELECT count(*) FROM "User";' | tr -d '[:space:]')
  TABLES=$($COMPOSE exec -T postgres psql -U lao -d lao_verify -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" | tr -d '[:space:]')
  $COMPOSE exec -T postgres psql -U lao -d postgres -c 'DROP DATABASE lao_verify;' >/dev/null

  echo "[backup] restored: $TABLES tables, $USERS users"
  if [ "$TABLES" -lt 30 ]; then
    echo "[backup] FAILED: restored only $TABLES tables, expected 33" >&2
    exit 1
  fi
  echo "[backup] verified"
fi

echo "[backup] pruning dumps older than $KEEP_DAYS days"
find "$BACKUP_DIR" -name 'lao-*.sql.gz' -mtime "+$KEEP_DAYS" -delete
ls -1 "$BACKUP_DIR"/lao-*.sql.gz | wc -l | xargs echo "[backup] dumps retained:"
