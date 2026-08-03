# LAO — production image.
#
# UNVERIFIED BUILD: written against a standalone bundle that was built and run
# for real (health 200, pages 200), but the image itself has not been built,
# because the verification environment has no Docker daemon. Build it once
# before relying on it.
#
# It replaces a Dockerfile that could not have worked, in five separate ways:
#
#   1. `pnpm install --frozen-lockfile` against a pnpm-lock.yaml that does not
#      exist. The repo uses npm workspaces and ships package-lock.json. This is
#      the same defect the release-candidate workflow had before it was fixed.
#   2. It started `.next/standalone/server.js`, but next.config.js had no
#      `output: 'standalone'`, so that file was never produced.
#   3. Even with standalone output the path was wrong: in a workspace the
#      entrypoint is `.next/standalone/apps/lao-web/server.js`.
#   4. HEALTHCHECK polled `/health`, which is a 404. The route is `/api/health`.
#      The container would have run correctly and been reported unhealthy for
#      ever.
#   5. node:20-alpine, while CI and every verified build use Node 22.

# ---------------------------------------------------------------- builder ---
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat

# Manifests and workspace sources first, so editing a page does not invalidate
# the install layer. postinstall runs prisma generate, which needs the schema
# under packages/.
COPY package.json package-lock.json turbo.json ./
COPY apps/lao-web/package.json ./apps/lao-web/
COPY packages ./packages

# `npm ci`, not `npm install`: the lockfile is the contract, and a build that
# quietly resolves a different tree is not the build that was tested.
RUN npm ci

COPY . .

# Build-time values only. Real secrets arrive at run time; these exist because
# configuration is validated at module load, so collecting page data would
# otherwise fail with "DATABASE_URL: Required" on a machine that has no
# database and should not have one.
ENV PRODUCT_ID=lao \
    PRODUCT_NAME="LAO Academy" \
    DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public" \
    NEXTAUTH_SECRET="build-time-placeholder-replaced-at-runtime" \
    NEXTAUTH_URL="http://localhost:3000" \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build --workspace=lao-web

# ---------------------------------------------------------------- runtime ---
FROM node:22-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache curl dumb-init libc6-compat

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

# The standalone bundle carries its own pruned node_modules, including the
# workspace packages traced out of packages/. Nothing is installed here.
COPY --from=builder /app/apps/lao-web/.next/standalone ./
# Static and public files are deliberately excluded from the standalone trace
# and have to be placed alongside it, or every stylesheet 404s.
COPY --from=builder /app/apps/lao-web/.next/static ./apps/lao-web/.next/static
COPY --from=builder /app/apps/lao-web/public ./apps/lao-web/public

# Migrations run at container start, so a deploy can never reach a schema the
# code does not expect. Needs the CLI and the schema, which the standalone
# trace has no reason to include.
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/packages/iriskey/database/prisma ./prisma

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 \
    && chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

# /api/health, not /health. The latter is a 404 and would report a working
# container as unhealthy for ever.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://localhost:3000/api/health || exit 1

ENTRYPOINT ["dumb-init", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "apps/lao-web/server.js"]
