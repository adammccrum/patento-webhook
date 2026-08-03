#!/bin/sh
#
# Migrate, then serve.
#
# Running migrations at start means a container can never come up against a
# schema its code does not expect. It is safe here because there is exactly one
# instance: `migrate deploy` takes an advisory lock, so a second instance would
# wait rather than corrupt anything, but a rolling deploy of several replicas
# would still want this pulled out into a one-shot job.
#
# The seed is deliberately not run. It is idempotent, but content belongs to a
# deliberate act, not to whenever a container happens to restart.
set -eu

echo "[entrypoint] applying migrations"
if ! ./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma; then
  echo "[entrypoint] migrations failed — refusing to start" >&2
  # Exit rather than serve. A server running against a schema it does not
  # expect fails later, in front of a user, with a worse error.
  exit 1
fi

echo "[entrypoint] starting: $*"
exec "$@"
