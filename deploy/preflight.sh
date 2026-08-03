#!/usr/bin/env bash
#
# Pre-build gate. Run on the VPS immediately before `docker build`.
#
#   bash deploy/preflight.sh
#
# Answers one question: is the thing about to be built the thing that was
# committed and reviewed?
#
# The failure it exists to catch is not a typo. It is the moment during a
# deployment when something does not work, a fix gets typed directly into the
# server, the deploy succeeds, and the repository no longer describes what is
# running. Everything works until the box is rebuilt, and then nobody knows
# why it stopped.
#
# It also caught a real one before the first build: the working copy had
# silently reverted to a three-week-old commit, and a build ran against a
# Dockerfile nobody had looked at — producing a failure that appeared to be
# about the new work and was not.
set -uo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

EXPECTED_BRANCH="${EXPECTED_BRANCH:-claude/lao-master-build-directive-ih1mi8}"
PROBLEMS=0

fail() { printf ' FAIL   %s\n' "$*"; PROBLEMS=$((PROBLEMS + 1)); }
pass() { printf '  ok    %s\n' "$*"; }

echo ""
echo "Pre-build verification"
echo ""

# ---------------------------------------------------------------- identity ---
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
SUBJECT="$(git log -1 --pretty=%s 2>/dev/null || echo unknown)"

if [ "$BRANCH" = "$EXPECTED_BRANCH" ]; then
  pass "branch: $BRANCH"
else
  fail "branch is '$BRANCH', expected '$EXPECTED_BRANCH'"
fi

pass "commit: $COMMIT — $SUBJECT"

# Behind the remote is not automatically wrong, but it is worth knowing before
# a build rather than after one.
git fetch --quiet origin "$EXPECTED_BRANCH" 2>/dev/null || true
if git rev-parse --verify --quiet FETCH_HEAD >/dev/null 2>&1; then
  BEHIND="$(git rev-list --count HEAD..FETCH_HEAD 2>/dev/null || echo 0)"
  if [ "$BEHIND" -gt 0 ]; then
    fail "$BEHIND commit(s) behind origin — run: git reset --hard origin/$EXPECTED_BRANCH"
  else
    pass "up to date with origin"
  fi
fi

# ------------------------------------------------------- nothing local-only ---
# The rule is that fixes live in the repository. This is that rule, checked.
if git diff --quiet HEAD -- 2>/dev/null; then
  pass "no uncommitted modifications"
else
  fail "the working tree differs from HEAD — these changes exist only on this machine:"
  git diff --name-only HEAD | sed 's/^/          /'
fi

UNTRACKED="$(git ls-files --others --exclude-standard | grep -v '^deploy/\.env$' || true)"
if [ -n "$UNTRACKED" ]; then
  fail "untracked files present — not in the repository, so not reproducible:"
  echo "$UNTRACKED" | sed 's/^/          /'
else
  pass "no stray untracked files"
fi

# ------------------------------------------------------------- build inputs ---
for f in Dockerfile docker-entrypoint.sh deploy/docker-compose.prod.yml deploy/Caddyfile; do
  if [ ! -f "$f" ]; then
    fail "$f is missing"
    continue
  fi
  SIZE=$(wc -c < "$f" | tr -d '[:space:]')
  SUM=$(sha256sum "$f" | cut -c1-12)
  GIT_SUM=$(git show "HEAD:$f" 2>/dev/null | sha256sum | cut -c1-12)
  if [ "$SUM" = "$GIT_SUM" ]; then
    pass "$f — ${SIZE} bytes, sha256 ${SUM}"
  else
    fail "$f differs from the committed version (disk ${SUM}, git ${GIT_SUM})"
  fi
done

# The old broken Dockerfile is 1780 bytes and starts with a different line.
# Naming it explicitly turns "why did the build fail" into one glance.
if head -1 Dockerfile | grep -q 'Multi-stage build for IrisKey Platform'; then
  fail "this is the OLD Dockerfile — it installs with pnpm against a lockfile that does not exist"
fi

echo ""
bash scripts/verify-dockerfile-paths.sh || PROBLEMS=$((PROBLEMS + 1))

echo ""
if [ "$PROBLEMS" -eq 0 ]; then
  echo "Pre-build verification passed. Safe to build $COMMIT."
  echo ""
  echo "  docker build -t lao:$COMMIT -t lao:latest ."
  exit 0
fi

echo "$PROBLEMS problem(s). Do not build until these are resolved in the repository."
echo "Fix in git, push, pull here — do not edit files on this server."
exit 1
