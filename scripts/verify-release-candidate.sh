#!/usr/bin/env bash
#
# Release candidate verification.
#
# Proves the sequence a real deployment performs, from nothing:
#
#   clean checkout → install → migrate → seed → build → run → learner journey
#
# No existing data is required and none is reused. The checkout is a fresh
# clone of the committed HEAD, so an uncommitted file on a developer machine
# cannot make this pass. The database is dropped and recreated, so a row
# someone inserted by hand months ago cannot make this pass either.
#
# That second point is not hypothetical. Course 1 existed in development only
# because an admin had once POSTed the seed endpoint. On a fresh database the
# first thing a learner is invited to do returned 404. Nothing caught it,
# because nothing had ever started from nothing.
#
# Usage:
#
#   RC_DATABASE_URL='postgresql://user@host:5432/lao_release_candidate' \
#     scripts/verify-release-candidate.sh
#
# The database named in RC_DATABASE_URL is DROPPED and recreated. As a
# safeguard the name must contain "release_candidate" or end in "_rc"; the
# script refuses to run against anything else.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${RC_PORT:-3400}"
BASE="http://localhost:${PORT}"
WORKDIR="$(mktemp -d -t lao-rc-XXXXXX)"
JAR="${WORKDIR}/cookies.txt"
SERVER_LOG="${WORKDIR}/server.log"
SERVER_PID=""

STEP=0
step()  { STEP=$((STEP + 1)); printf '\n\033[1m[%d] %s\033[0m\n' "$STEP" "$1"; }
ok()    { printf '    \033[32m✓\033[0m %s\n' "$1"; }
fail()  { printf '    \033[31m✗ %s\033[0m\n' "$1"; exit 1; }

cleanup() {
  local status=$?
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
    # Do not leave until the port is actually free, or the next run probes a
    # server that is on its way out and reports someone else's results.
    for _ in $(seq 1 20); do
      curl -s -o /dev/null --max-time 1 "${BASE}/api/alive" 2>/dev/null || break
      sleep 0.5
    done
  fi
  if [[ $status -ne 0 ]]; then
    printf '\n\033[31mRelease candidate verification FAILED at step %d.\033[0m\n' "$STEP"
    if [[ -s "$SERVER_LOG" ]]; then
      printf '\nLast 40 lines of server log:\n'
      tail -40 "$SERVER_LOG"
    fi
    printf '\nWorking directory kept for inspection: %s\n' "$WORKDIR"
  else
    rm -rf "$WORKDIR"
  fi
}
trap cleanup EXIT

# ---------------------------------------------------------------------------

: "${RC_DATABASE_URL:?Set RC_DATABASE_URL to a throwaway database this script may drop}"

# Strip the query string before taking the basename — a socket URL carries a
# path in `?host=/tmp`, and reading the name first would yield "tmp".
RC_URL_PATH="${RC_DATABASE_URL%%\?*}"
DB_NAME="${RC_URL_PATH##*/}"
ADMIN_URL="${RC_DATABASE_URL/\/${DB_NAME}/\/postgres}"

if [[ ! "$DB_NAME" =~ (release_candidate|_rc)$ ]]; then
  fail "Refusing to drop '${DB_NAME}'. Name the verification database *_release_candidate or *_rc."
fi

printf '\033[1mLAO release candidate verification\033[0m\n'
printf 'commit    %s\n' "$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
printf 'branch    %s\n' "$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"
printf 'database  %s (will be dropped and recreated)\n' "$DB_NAME"
printf 'port      %s\n' "$PORT"

# ---------------------------------------------------------------------------

step "Clean checkout"

if [[ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]]; then
  printf '    \033[33m!\033[0m Working tree has uncommitted changes. They are NOT included —\n'
  printf '      a release candidate is what is committed.\n'
fi

git clone --quiet --depth 1 "file://${REPO_ROOT}" "${WORKDIR}/checkout"
CHECKOUT="${WORKDIR}/checkout"
[[ -d "${CHECKOUT}/node_modules" ]] && fail "Clone contains node_modules — not a clean checkout"
[[ -f "${CHECKOUT}/apps/lao-web/.env" ]] && fail "Clone contains a committed .env — secrets must not be in the repo"
ok "cloned at $(git -C "$CHECKOUT" rev-parse --short HEAD), no node_modules, no .env"

cat > "${CHECKOUT}/apps/lao-web/.env" <<EOF
PRODUCT_ID="lao"
PRODUCT_NAME="LAO Academy"
DATABASE_URL="${RC_DATABASE_URL}"
NEXTAUTH_SECRET="release-candidate-verification-secret-not-for-production"
NEXTAUTH_URL="${BASE}"
NODE_ENV="production"
LOG_LEVEL="warn"
EOF
cp "${CHECKOUT}/apps/lao-web/.env" "${CHECKOUT}/.env"
ok "environment written (no provider credentials — the collaborator must degrade, not crash)"

# ---------------------------------------------------------------------------

step "Install"

( cd "$CHECKOUT" && npm install --no-audit --no-fund >"${WORKDIR}/install.log" 2>&1 ) \
  || { tail -30 "${WORKDIR}/install.log"; fail "npm install failed"; }
ok "dependencies installed and prisma client generated"

# ---------------------------------------------------------------------------

step "Database created empty"

psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q \
  -c "DROP DATABASE IF EXISTS \"${DB_NAME}\" WITH (FORCE);" \
  -c "CREATE DATABASE \"${DB_NAME}\";" >/dev/null
TABLES=$(psql "$RC_DATABASE_URL" -tAc \
  "select count(*) from information_schema.tables where table_schema='public'")
[[ "$TABLES" == "0" ]] || fail "Database is not empty — found ${TABLES} tables"
ok "${DB_NAME} recreated, 0 tables"

# ---------------------------------------------------------------------------

step "Migrate"

# Deliberately the documented command, run the way a deployment runs it.
# Reaching into the package directly is how the missing DATABASE_URL stayed
# hidden: it worked from a shell that happened to have the variable exported.
( cd "$CHECKOUT" && npm run db:deploy >"${WORKDIR}/migrate.log" 2>&1 ) \
  || { tail -30 "${WORKDIR}/migrate.log"; fail "npm run db:deploy failed"; }
TABLES=$(psql "$RC_DATABASE_URL" -tAc \
  "select count(*) from information_schema.tables where table_schema='public'")
[[ "$TABLES" -gt 10 ]] || fail "Migration produced only ${TABLES} tables"
ok "migrations applied, ${TABLES} tables"

# ---------------------------------------------------------------------------

step "Seed"

( cd "$CHECKOUT" && npm run seed >"${WORKDIR}/seed.log" 2>&1 ) \
  || { tail -30 "${WORKDIR}/seed.log"; fail "seed failed"; }
grep -q 'Course 1' "${WORKDIR}/seed.log" || fail "Seed did not report on Course 1"
ok "$(grep 'Course 1' "${WORKDIR}/seed.log" | head -1)"

# Running it twice is part of the contract: deploys re-run seeds.
( cd "$CHECKOUT" && npm run seed >"${WORKDIR}/seed2.log" 2>&1 ) \
  || fail "second seed run failed — seeding is not idempotent"
grep -q 'already present' "${WORKDIR}/seed2.log" \
  || fail "second seed run did not recognise existing content — not idempotent"
ok "idempotent: $(grep 'Course 1' "${WORKDIR}/seed2.log" | head -1)"

MISSIONS=$(psql "$RC_DATABASE_URL" -tAc \
  "select count(*) from \"Mission\" m join \"Course\" c on m.\"courseId\"=c.id where c.slug='course-1'")
[[ "$MISSIONS" == "5" ]] || fail "Expected 5 missions in course-1, found ${MISSIONS}"
ok "course-1 present with 5 missions"

# ---------------------------------------------------------------------------

step "Build"

( cd "$CHECKOUT" && npx turbo run type-check >"${WORKDIR}/typecheck.log" 2>&1 ) \
  || { tail -30 "${WORKDIR}/typecheck.log"; fail "type-check failed"; }
ok "type-check clean"

( cd "$CHECKOUT" && npx turbo run build >"${WORKDIR}/build.log" 2>&1 ) \
  || { tail -30 "${WORKDIR}/build.log"; fail "production build failed"; }
ok "production build succeeded"

# ---------------------------------------------------------------------------

step "Run"

# Refuse to start on an occupied port. Without this, `next start` fails with
# EADDRINUSE while the probe below cheerfully succeeds against whatever is
# already listening — and the whole journey then runs against the wrong build.
# That happened, and it read as a product bug for a good ten minutes.
if curl -s -o /dev/null --max-time 2 "${BASE}/api/alive" 2>/dev/null; then
  fail "Something is already listening on ${PORT}. Stop it, or set RC_PORT."
fi

# `exec` so SERVER_PID is the server itself. Backgrounding `npm run start`
# leaves npm as the parent and `next start` as a grandchild that survives the
# kill in cleanup — which is exactly how the stale server above came to exist.
( cd "${CHECKOUT}/apps/lao-web" && exec ../../node_modules/.bin/next start -p "$PORT" ) \
  >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

for i in $(seq 1 60); do
  if curl -sf "${BASE}/api/alive" >/dev/null 2>&1; then break; fi
  kill -0 "$SERVER_PID" 2>/dev/null || fail "Server exited during startup"
  [[ $i -eq 60 ]] && fail "Server did not become ready within 60s"
  sleep 1
done
ok "server responding on ${BASE}, pid ${SERVER_PID}"

HEALTH=$(curl -s "${BASE}/api/health")
echo "$HEALTH" | grep -q '"database"' || fail "Health check does not report on the database"
echo "$HEALTH" | grep -qi 'unhealthy\|"down"' && fail "Health check reports unhealthy: ${HEALTH}"
ok "health check green, database reachable"

# ---------------------------------------------------------------------------

step "Complete learner journey, with no intervention"

EMAIL="rc-$(date +%s)@example.com"
PASSWORD='Rc-Verification-2026!x'

# Sets CODE and RESP in *this* shell. Deliberately not called through command
# substitution: that runs in a subshell, so the response body never comes back
# and every assertion about it silently passes on an empty string. It did, and
# a genuinely empty body read as "the course has no missions".
CODE=""
RESP=""
BODY_FILE="${WORKDIR}/resp"

call() {
  local method="$1" path="$2" body="${3:-}"
  local args=(-s -o "$BODY_FILE" -w '%{http_code}' -b "$JAR" -c "$JAR" -X "$method" "${BASE}${path}")
  [[ -n "$body" ]] && args+=(-H 'Content-Type: application/json' -d "$body")
  CODE="$(curl "${args[@]}")"
  RESP="$(cat "$BODY_FILE")"
}

# expect <label> <status> <method> <path> [body]
expect() {
  local label="$1" want="$2"
  shift 2
  call "$@"
  [[ "$CODE" == "$want" ]] \
    || fail "${label} → HTTP ${CODE} (expected ${want}) :: $(head -c 300 "$BODY_FILE")"
  ok "${label} → ${CODE}"
}

# Read a value out of the last response. Real JSON parsing, because a regex
# over JSON is how "no missions" got reported for a response full of missions.
json() {
  node -e '
    const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const v = process.argv[2].split(".").reduce((o, k) => o?.[k], d);
    if (v === undefined || v === null) process.exit(1);
    process.stdout.write(String(v));
  ' "$BODY_FILE" "$1"
}

expect "register" 201 POST /api/auth/register \
  "{\"name\":\"RC Verifier\",\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}"

CSRF="$(curl -s -b "$JAR" -c "$JAR" "${BASE}/api/auth/csrf" | sed 's/.*"csrfToken":"\([^"]*\)".*/\1/')"
[[ -n "$CSRF" ]] || fail "Could not obtain a CSRF token"
curl -s -o /dev/null -b "$JAR" -c "$JAR" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "csrfToken=${CSRF}&email=${EMAIL}&password=${PASSWORD}&json=true&redirect=false" \
  "${BASE}/api/auth/callback/credentials"
grep -q 'session-token' "$JAR" || fail "Sign in produced no session cookie"
ok "sign in → session established"

expect "dashboard" 200 GET /api/dashboard

expect "open course 1" 200 GET /api/courses/course-1
COURSE_ID="$(json course.id)" || fail "Course response has no id"
MISSION_COUNT="$(json course.missions.length)" || fail "Course returned no missions array"
[[ "$MISSION_COUNT" == "5" ]] || fail "Course has ${MISSION_COUNT} missions, expected 5"
MISSION_ID="$(json course.missions.0.id)" || fail "Could not read the first mission id"
ok "course resolved with ${MISSION_COUNT} missions, first is ${MISSION_ID:0:8}…"

expect "open mission" 200 GET "/api/missions/${MISSION_ID}"

expect "complete mission" 200 POST /api/missions/complete \
  "{\"missionId\":\"${MISSION_ID}\",\"courseId\":\"${COURSE_ID}\",\"reflection\":\"Verification run.\",\"problem\":\"Replying to the same email every week.\",\"content\":\"A short reusable reply.\"}"

expect "toolbox lists the solution" 200 GET /api/solutions
SOLUTION_ID="$(json solutions.0.id)" || fail "Completing a mission produced no solution"
SOLUTION_NAME="$(json solutions.0.name)" || true
ok "solution in the toolbox: ${SOLUTION_NAME:-untitled}"

expect "open solution" 200 GET "/api/solutions/${SOLUTION_ID}"

# With no provider configured the collaborator answers 200 and says plainly
# that it cannot suggest an improvement. It does not fail, and it does not
# invent one. 503 is only for a configured provider that could not be reached.
call POST "/api/solutions/${SOLUTION_ID}/collaborate" \
  '{"intent":"improve","message":"Make this shorter."}'
case "$CODE" in
  200)
    REPLY="$(json message.content)" || fail "Collaborator replied with no content"
    if [[ "$(json degraded || echo false)" == "true" ]]; then
      json message.proposedContent >/dev/null 2>&1 \
        && fail "Collaborator proposed content with no provider configured"
      ok "collaborator → 200, says plainly it cannot suggest an improvement"
    else
      ok "collaborator → 200, a provider is configured and answered"
    fi
    # Provider independence is not negotiable. The workspace must never name
    # who served the request.
    if grep -qiE 'claude|anthropic|openai|gpt-|gemini|llama|qwen|deepseek|mistral' <<<"$REPLY"; then
      fail "Collaborator reply names a provider: $(head -c 200 <<<"$REPLY")"
    fi
    ok "collaborator names no provider"
    ;;
  503) ok "collaborator → 503, a configured provider was unreachable" ;;
  *)   fail "collaborator → HTTP ${CODE} :: $(head -c 300 "$BODY_FILE")" ;;
esac

expect "record a use" 200 POST "/api/solutions/${SOLUTION_ID}/run" '{}'

expect "export my data" 200 GET /api/account/export
grep -q "$EMAIL" "$BODY_FILE" || fail "Export does not contain the learner's own account"
# The export deliberately carries no internal ids — it is for the person, not
# for re-import — so check it by what they would recognise.
EXPORTED_NAME="$(json solutions.0.name)" || fail "Export contains no solutions"
[[ "$EXPORTED_NAME" == "$SOLUTION_NAME" ]] \
  || fail "Export lists '${EXPORTED_NAME}', expected '${SOLUTION_NAME}'"
json solutions.0.content >/dev/null || fail "Exported solution has no content"
json solutions.0.versions.length >/dev/null || fail "Exported solution has no version history"
json solutions.0.uses.length >/dev/null || fail "Exported solution has no usage history"
ok "export contains '${EXPORTED_NAME}' with its content, versions and uses"

expect "delete my account" 200 DELETE /api/account "{\"confirmEmail\":\"${EMAIL}\"}"

LEFT=$(psql "$RC_DATABASE_URL" -tAc \
  "select count(*) from \"User\" where email='${EMAIL}'")
[[ "$LEFT" == "0" ]] || fail "Account still present after deletion"
SOLUTIONS_LEFT=$(psql "$RC_DATABASE_URL" -tAc \
  "select count(*) from \"Solution\" where id='${SOLUTION_ID}'")
[[ "$SOLUTIONS_LEFT" == "0" ]] || fail "Solutions survived account deletion"
ok "account and all its data gone from the database"

# ---------------------------------------------------------------------------

step "Result"

if grep -qiE '\berror\b|unhandled|ECONNREFUSED' "$SERVER_LOG"; then
  printf '    \033[33m!\033[0m Server log contains error lines — review %s\n' "$SERVER_LOG"
  grep -iE '\berror\b|unhandled|ECONNREFUSED' "$SERVER_LOG" | head -5
fi

printf '\n\033[32m\033[1mRELEASE CANDIDATE VERIFIED\033[0m\n'
printf 'From a clean clone and an empty database, a learner can sign up, work\n'
printf 'through Course 1, keep a solution, use it, export their data and delete\n'
printf 'their account. No manual step was required at any point.\n\n'
