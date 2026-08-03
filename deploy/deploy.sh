#!/usr/bin/env bash
#
# Deploy, or refuse to.
#
#   deploy/deploy.sh              build and release the current checkout
#   deploy/deploy.sh --no-backup  first deploy only, when there is no database
#
# The order is deliberate. It takes a backup before touching anything, because
# the entrypoint applies migrations and Prisma has no down-migrations: once a
# migration has run, the only way back is a restore. It then verifies the new
# containers are actually healthy, and tells you how to roll back if they are
# not — rather than exiting 0 on a stack that came up broken.
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="docker compose -f deploy/docker-compose.prod.yml"

say() { echo -e "\n[deploy] $*"; }
fail() { echo -e "\n[deploy] FAILED: $*" >&2; exit 1; }

[ -f deploy/.env ] || fail "deploy/.env is missing. Copy .env.example and fill it in."

# Refuse to deploy with a placeholder secret. The default in .env.example is
# public, and a session cookie signed with a public key is not a session.
if grep -qE '^NEXTAUTH_SECRET=.*(change-this|your-super-secret|placeholder)' deploy/.env; then
  fail "NEXTAUTH_SECRET is still the example value. Generate one: openssl rand -base64 48"
fi

RELEASE="$(git rev-parse --short HEAD)"
say "deploying $RELEASE"
git status --porcelain | grep -q . && say "WARNING: working tree is dirty; deploying it anyway"

# ------------------------------------------------------------------ backup ---
if [ "${1:-}" != "--no-backup" ]; then
  if $COMPOSE ps --status running 2>/dev/null | grep -q postgres; then
    say "backing up before migrating"
    deploy/backup.sh || fail "backup failed — refusing to deploy without one"
  else
    say "no running database; skipping backup"
  fi
else
  say "backup skipped by --no-backup"
fi

# Recorded so a rollback does not depend on remembering what was running.
PREVIOUS="$(cat .last-deployed-sha 2>/dev/null || echo '')"

# ------------------------------------------------------------------- build ---
say "building"
$COMPOSE build || fail "build failed — nothing was changed, the old stack is still running"

say "starting"
$COMPOSE up -d || fail "compose up failed"

# ------------------------------------------------------------------ verify ---
say "waiting for health"
HEALTHY=0
for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null http://localhost:3000/api/health 2>/dev/null \
     || $COMPOSE exec -T app curl -fsS -o /dev/null http://localhost:3000/api/health 2>/dev/null; then
    HEALTHY=1
    break
  fi
  sleep 5
done

if [ "$HEALTHY" -ne 1 ]; then
  echo ""
  $COMPOSE ps
  echo ""
  $COMPOSE logs --tail 40 app
  echo ""
  echo "[deploy] the new release is NOT healthy."
  if [ -n "$PREVIOUS" ]; then
    echo "[deploy] roll back with:"
    echo "           git checkout $PREVIOUS && deploy/deploy.sh --no-backup"
  fi
  echo "[deploy] if a migration ran, see the restore procedure in deploy/DEPLOYMENT_PLAN.md"
  exit 1
fi

echo "$RELEASE" > .last-deployed-sha

say "healthy"
$COMPOSE ps
echo ""
echo "[deploy] $RELEASE is live."
echo "[deploy] Verify from OUTSIDE the server before telling anyone:"
echo "           curl -fsS https://\$DOMAIN/api/health"
echo "           and work through the checklist in deploy/DEPLOYMENT_PLAN.md"
