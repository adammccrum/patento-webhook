#!/usr/bin/env bash
#
# Password reset and email verification, end to end.
#
# Starts a production build against a real database and drives both flows over
# real HTTP. The server is restarted between phases because the reset endpoints
# share a rate limit of three requests per hour per address — the correct
# setting, and one that must not be loosened to make a test convenient. The
# in-memory limiter resets with the process, so a restart is the honest way to
# get a clean signal rather than raising the limit.
#
#   DATABASE_URL=... bash scripts/verify-email-flows.sh
#
set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
PORT="${PORT:-3000}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/lao?schema=public}"
export PRODUCT_ID="${PRODUCT_ID:-lao}"
export PRODUCT_NAME="${PRODUCT_NAME:-LAO Academy}"
export NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-local-e2e-secret-not-production-000000}"
export NEXTAUTH_URL="${NEXTAUTH_URL:-$BASE_URL}"
export NODE_ENV=production

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SERVER_PID=""

stop_server() {
  # Killing the npm wrapper leaves the server running: the child process is
  # named `next-server`, so neither the recorded PID nor `pkill -f "next start"`
  # matches it. The wrapper exits, the port stays bound, and the next phase
  # talks to the old process with its old rate-limit counters — which reads as
  # a mysterious 429 rather than as a stale server.
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
  # The bracket keeps the pattern from matching pkill's own command line —
  # without it, any shell whose command string contains the pattern is killed
  # too, including the one running this script.
  pkill -f "[n]ext-server" 2>/dev/null || true
  SERVER_PID=""

  # Confirmed by HTTP, not by the process table: the only question that matters
  # is whether anything still answers.
  for _ in $(seq 1 30); do
    curl -sf -o /dev/null "$BASE_URL/api/health" 2>/dev/null || return 0
    sleep 1
  done
  echo "the previous server is still answering on $BASE_URL" >&2
  return 1
}

start_server() {
  (cd apps/lao-web && npm run start -- -p "$PORT") > /tmp/lao-e2e-server.log 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 60); do
    if curl -sf -o /dev/null "$BASE_URL/api/health" 2>/dev/null; then return 0; fi
    sleep 1
  done
  echo "server did not become healthy; last log lines:" >&2
  tail -20 /tmp/lao-e2e-server.log >&2
  return 1
}

trap stop_server EXIT

FAILED=0
for phase in 1 2 3 4; do
  stop_server || exit 1
  start_server || exit 1
  if ! npx tsx scripts/verify-email-flows.ts "$phase"; then
    FAILED=1
  fi
done

stop_server

if [ "$FAILED" -eq 0 ]; then
  echo ""
  echo "All phases passed. A locked-out learner can get back in."
else
  echo ""
  echo "Email flow verification FAILED."
fi
exit "$FAILED"
