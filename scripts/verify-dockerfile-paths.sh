#!/usr/bin/env bash
#
# Verify every path the Dockerfile claims exists.
#
#   bash scripts/verify-dockerfile-paths.sh
#
# A `COPY` whose source is missing fails the image build — after however many
# minutes the layers before it took. On a laptop that is annoying; on a
# production VPS during a deployment window it is the moment people start
# typing fixes directly into the server, which is how a deployment stops being
# reproducible.
#
# This found two real ones before the first build was ever attempted:
#
#   - `apps/lao-web/public` did not exist. Next serves it at the site root and
#     the standalone trace deliberately excludes it, so the image has to copy
#     it — from a directory that was not there.
#   - the entrypoint invoked `node_modules/.bin/prisma`, a symlink the runtime
#     stage never copied. The image would have built, started, failed to
#     migrate, and exited 1 without serving a request.
#
# Runtime-stage sources are checked after a build, because that is when they
# exist. Run `npm run build --workspace=lao-web` first, or those are skipped
# with a warning rather than silently passing.
set -uo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PROBLEMS=0
CHECKED=0

report() {
  CHECKED=$((CHECKED + 1))
  if [ -e "$2" ]; then
    printf '  ok      %s\n' "$1"
  else
    printf ' MISSING  %s  ->  %s\n' "$1" "$2"
    PROBLEMS=$((PROBLEMS + 1))
  fi
}

echo ""
echo "Dockerfile COPY sources"
echo ""

# Sources copied from the build context. Paths are repo-relative.
grep -E '^COPY ' Dockerfile | grep -v -- '--from=' | while read -r _ rest; do
  # Everything but the final argument, which is the destination.
  set -- $rest
  n=$#
  i=1
  for arg in "$@"; do
    [ "$i" -eq "$n" ] && break
    echo "context|$arg|$arg"
    i=$((i + 1))
  done
done > /tmp/dockerfile-paths.txt

# Sources copied out of the builder stage. /app is the build context root, so
# /app/X is X in the repository — except for build outputs, which only exist
# after a build.
grep -E '^COPY --from=builder ' Dockerfile | while read -r _ _ src _; do
  echo "builder|$src|${src#/app/}"
done >> /tmp/dockerfile-paths.txt

BUILT=0
[ -d apps/lao-web/.next/standalone ] && BUILT=1

while IFS='|' read -r stage shown path; do
  [ -z "$path" ] && continue
  case "$path" in
    *.next/*|*node_modules/*)
      if [ "$BUILT" -eq 0 ]; then
        printf '  skip    %s  (build output; run the build first)\n' "$shown"
        continue
      fi
      ;;
  esac
  report "$shown" "$path"
done < /tmp/dockerfile-paths.txt

echo ""
echo "Entrypoint"
echo ""

# The entrypoint runs inside the runtime stage, where only what was explicitly
# copied exists. A binary it calls that was never copied is a container that
# starts and immediately exits.
# Comments stripped first. The entrypoint carries a comment explaining why it
# does NOT use node_modules/.bin, and a checker that cannot tell code from
# commentary reports a defect that is not there — which is how a checker gets
# ignored, and then gets ignored on the day it is right.
ENTRYPOINT_CODE="$(sed 's/#.*//' docker-entrypoint.sh)"

if echo "$ENTRYPOINT_CODE" | grep -q 'node_modules/\.bin/'; then
  if ! grep -q 'node_modules/\.bin' Dockerfile; then
    echo " MISSING  docker-entrypoint.sh calls node_modules/.bin/... which the runtime stage does not copy"
    PROBLEMS=$((PROBLEMS + 1))
  fi
  CHECKED=$((CHECKED + 1))
else
  echo "  ok      does not depend on node_modules/.bin symlinks"
  CHECKED=$((CHECKED + 1))
fi

for target in $(echo "$ENTRYPOINT_CODE" | grep -oE 'node \./[^ ]+' | awk '{print $2}'); do
  report "entrypoint runs $target" "${target#./}"
done

echo ""
if [ "$PROBLEMS" -eq 0 ]; then
  echo "$CHECKED paths checked, all present."
  [ "$BUILT" -eq 0 ] && echo "NOTE: build outputs were skipped. Build, then run this again."
  exit 0
fi

echo "$PROBLEMS of $CHECKED paths are missing. The image build would fail."
exit 1
