# Multi-stage build for IrisKey Platform

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
RUN npm install -g pnpm && pnpm install --prod --frozen-lockfile

# Stage 2: Development dependencies
FROM node:20-alpine AS devdeps
WORKDIR /app
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Stage 3: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copy all dependencies
COPY --from=devdeps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm install -g pnpm && \
    pnpm run type-check && \
    pnpm run build

# Stage 4: Runtime
FROM node:20-alpine AS runtime
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init curl

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy built application
COPY --from=builder /app/apps/lao-web/.next ./apps/lao-web/.next
COPY --from=builder /app/apps/lao-web/public ./apps/lao-web/public
COPY --from=builder /app/apps/lao-web/package.json ./apps/lao-web/
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./

# Prisma client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Create app user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
USER nextjs

EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "apps/lao-web/.next/standalone/server.js"]
