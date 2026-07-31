# IrisKey Platform - Deployment Guide

**Version**: 2.6  
**Last Updated**: 2024-07-31  
**Status**: Production Ready

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Local Development](#local-development)
3. [Docker Deployment](#docker-deployment)
4. [Production Deployment](#production-deployment)
5. [Environment Configuration](#environment-configuration)
6. [Database Migrations](#database-migrations)
7. [Monitoring & Health Checks](#monitoring--health-checks)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites
- Node.js 20+ (or Docker)
- PostgreSQL 16+ (or Docker Compose)
- Redis 7+ (or Docker Compose)
- pnpm 8+

### Using Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourdomain/patento-webhook.git
cd patento-webhook

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your configuration
nano .env.local

# Start services
docker-compose up -d

# Run database migrations
docker exec iriskey-lao-web pnpm db:push

# Application is ready at http://localhost:3000
```

### Manual Setup (Without Docker)

```bash
# Install dependencies
pnpm install

# Setup environment
cp .env.example .env.local
nano .env.local

# Start PostgreSQL and Redis (via brew, apt-get, etc.)
# PostgreSQL: brew services start postgresql@16
# Redis: brew services start redis

# Run database migrations
pnpm db:push

# Start development server
pnpm dev
```

---

## Local Development

### Development Setup

```bash
# Install all dependencies
pnpm install

# Copy environment template
cp .env.example .env.local

# Configure .env.local:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lao
REDIS_URL=redis://localhost:6379
NEXTAUTH_SECRET=dev-secret-key-change-in-production
NODE_ENV=development

# Generate Prisma Client
pnpm db:generate

# Run database migrations
pnpm db:push

# Seed database (optional)
pnpm db:seed

# Start dev server with hot reload
pnpm dev

# In another terminal, watch for type errors
pnpm run type-check --watch
```

### Database Commands

```bash
# View database schema
pnpm db:studio

# Create a migration
pnpm db:migrate:dev --name add_new_field

# Apply migrations
pnpm db:push

# Seed database
pnpm db:seed

# Reset database (CAUTION: deletes all data)
pnpm db:reset
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run tests with coverage
pnpm test --coverage

# Run specific test file
pnpm test auth.test.ts
```

---

## Docker Deployment

### Build Docker Image

```bash
# Build locally
docker build -t iriskey-lao:latest .

# Build with specific tag
docker build -t iriskey-lao:v1.0.0 .

# Tag for registry
docker tag iriskey-lao:latest your-registry/iriskey-lao:latest
docker push your-registry/iriskey-lao:latest
```

### Run Single Container

```bash
docker run -d \
  --name iriskey-lao-web \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:pass@postgres:5432/lao \
  -e REDIS_URL=redis://redis:6379 \
  -e NEXTAUTH_SECRET=$(openssl rand -base64 32) \
  -e NEXTAUTH_URL=https://yourdomain.com \
  -e NODE_ENV=production \
  iriskey-lao:latest
```

### Docker Compose (Production)

```yaml
# Use docker-compose.yml as template
# Set environment variables:
PRODUCT_ID=lao
PRODUCT_NAME="LAO - AI Learning Operating System"
DATABASE_USER=postgres
DATABASE_PASSWORD=secure_password_here
NEXTAUTH_SECRET=generated_secret_here
NEXTAUTH_URL=https://yourdomain.com
NODE_ENV=production

# Start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f lao-web

# Stop services
docker-compose down
```

### Health Checks

```bash
# Check application health
docker exec iriskey-lao-web curl -f http://localhost:3000/health

# Check PostgreSQL
docker exec iriskey-postgres pg_isready -U postgres

# Check Redis
docker exec iriskey-redis redis-cli ping
```

---

## Production Deployment

### Pre-Deployment Checklist

**Infrastructure**
- [ ] PostgreSQL 16+ database provisioned
- [ ] Redis 7+ cache provisioned
- [ ] Load balancer configured (if multiple instances)
- [ ] SSL/TLS certificate obtained (Let's Encrypt or similar)
- [ ] Domain DNS configured
- [ ] Backups configured for database

**Configuration**
- [ ] Environment variables set (all required ones)
- [ ] Secrets are strong and unique
- [ ] Database backups automated
- [ ] Monitoring/alerting configured
- [ ] Error tracking (Sentry) configured
- [ ] Log aggregation configured

**Application**
- [ ] All tests passing (pnpm test)
- [ ] No TypeScript errors (pnpm type-check)
- [ ] No ESLint warnings (pnpm lint)
- [ ] Production build succeeds (pnpm build)
- [ ] Security headers enabled
- [ ] Rate limiting configured

### Deploying to Cloud Platform

#### AWS (ECS / Fargate)

```bash
# 1. Push image to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
docker tag iriskey-lao:latest $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/iriskey-lao:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/iriskey-lao:latest

# 2. Create ECS task definition
aws ecs register-task-definition --cli-input-json file://ecs-task-def.json

# 3. Update ECS service
aws ecs update-service --cluster iriskey --service lao-web --force-new-deployment

# 4. Monitor deployment
aws ecs describe-services --cluster iriskey --services lao-web
```

#### Vercel (Next.js Optimized)

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Link to Vercel project
vercel link

# 3. Configure environment variables in Vercel dashboard
# NEXTAUTH_SECRET, DATABASE_URL, REDIS_URL, etc.

# 4. Deploy
vercel deploy --prod

# 5. Verify deployment
vercel list deployments
```

#### Render.com (Simple Platform)

```bash
# 1. Connect GitHub repository
# Settings → Deploy

# 2. Configure environment variables
# Settings → Environment

# 3. Configure build command
# pnpm build

# 4. Configure start command
# node apps/lao-web/.next/standalone/server.js

# 5. Deploy
# Automatic on push to main
```

### Environment Variables (Production)

```env
# Product Configuration
PRODUCT_ID=lao
PRODUCT_NAME=LAO - AI Learning Operating System

# Database (REQUIRED)
DATABASE_URL=postgresql://user:password@db.example.com:5432/lao
DB_MAX_CONNECTIONS=20
DB_MIN_CONNECTIONS=5

# Redis (REQUIRED for production)
REDIS_URL=redis://cache.example.com:6379

# Authentication (REQUIRED)
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=https://yourdomain.com
JWT_EXPIRES_IN=30d
PASSWORD_HASH_ROUNDS=12

# Environment
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# API Configuration
API_BASE_URL=https://yourdomain.com/api

# Logging & Monitoring
LOG_LEVEL=info
SENTRY_DSN=https://key@sentry.io/project-id

# Optional: OAuth Providers
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-secret>
GITHUB_CLIENT_ID=<your-client-id>
GITHUB_CLIENT_SECRET=<your-secret>
```

---

## Database Migrations

### Create New Migration

```bash
# Make schema changes in schema.prisma
nano packages/iriskey/database/prisma/schema.prisma

# Create and apply migration
pnpm db:migrate:dev --name descriptive_name

# Review generated migration
cat packages/iriskey/database/prisma/migrations/*/migration.sql
```

### Apply Existing Migrations

```bash
# Apply all pending migrations
pnpm db:push

# Check migration status
pnpm db:status

# View migration history
pnpm db:migrate:status
```

### Rollback Migration (Development Only)

```bash
# Rollback last migration
pnpm db:migrate:resolve --rolled-back <migration-name>

# Reset entire database (WARNING: deletes data)
pnpm db:reset
```

---

## Monitoring & Health Checks

### Health Endpoints

```bash
# Application health (dependencies, readiness)
curl https://yourdomain.com/health
# Response: { status: "healthy", uptime: 12345, checks: {...} }

# Readiness check (can accept traffic)
curl https://yourdomain.com/ready
# Response: { ready: true, checks: {...} }

# Liveness check (process alive)
curl https://yourdomain.com/alive
# Response: { alive: true, uptime: 12345 }
```

### Monitoring Setup

#### Sentry (Error Tracking)

```bash
# 1. Create Sentry project
# https://sentry.io/signup/

# 2. Set SENTRY_DSN in environment
export SENTRY_DSN=https://key@sentry.io/project-id

# 3. Monitor in Sentry dashboard
# https://sentry.io/organizations/your-org/issues/
```

#### Logs

```bash
# Docker Compose
docker-compose logs -f lao-web

# View structured logs
docker-compose logs lao-web | jq '.level, .message'

# Follow specific service
docker-compose logs -f postgres
```

#### Kubernetes (Optional)

```bash
# Check pod status
kubectl get pods -l app=iriskey-lao

# View logs
kubectl logs -f deployment/iriskey-lao-web

# Check health
kubectl exec -it <pod-name> -- curl http://localhost:3000/health
```

---

## Troubleshooting

### Application Won't Start

```bash
# 1. Check environment variables
env | grep DATABASE_URL
env | grep REDIS_URL
env | grep NEXTAUTH_SECRET

# 2. Check database connection
pg_isready -h localhost -p 5432

# 3. Check Redis connection
redis-cli -h localhost ping

# 4. Check logs
docker-compose logs lao-web

# 5. Verify database migrations
pnpm db:status
```

### High Memory Usage

```bash
# Check process memory
ps aux | grep node

# Enable memory debugging
NODE_DEBUG_NATIVE=fs,stream node apps/lao-web/.next/standalone/server.js

# Reduce connection pool size
DB_MAX_CONNECTIONS=10
DB_MIN_CONNECTIONS=2
```

### Database Connection Issues

```bash
# Test database connection
psql postgresql://user:pass@localhost:5432/lao -c "SELECT 1"

# Check connection pool status
pnpm db:stats

# Increase connection pool
DB_MAX_CONNECTIONS=30

# Add connection pooling (PgBouncer)
# pgbouncer -c pgbouncer.ini
```

### Rate Limiting Issues

```bash
# Check Redis connection
redis-cli ping

# View rate limit keys
redis-cli keys "ratelimit:*"

# Clear rate limits (development only)
redis-cli del $(redis-cli keys "ratelimit:*")
```

### Performance Issues

```bash
# Check slow queries
pnpm db:stats

# Enable query logging
DATABASE_LOGGING=true

# Check Sentry for errors
# https://sentry.io/organizations/your-org/

# Monitor CPU usage
top -p $(pgrep -f "node apps/lao-web")
```

---

## Rollback Procedure

### Rolling Back Code

```bash
# View deployment history
git log --oneline -10

# Rollback to previous version
git checkout <commit-hash>
git push --force-with-lease

# In production, redeploy previous version
docker pull your-registry/iriskey-lao:v1.0.0
docker-compose restart lao-web
```

### Database Rollback

```bash
# Create rollback migration
pnpm db:migrate:dev --name rollback_feature_x

# Or manually revert schema
git checkout HEAD~1 -- packages/iriskey/database/prisma/schema.prisma
pnpm db:push
```

---

## Scaling Considerations

### Horizontal Scaling (Multiple Instances)

```yaml
# Use load balancer to distribute traffic
# Application is stateless, scales horizontally

services:
  lao-web-1:
    # ... configuration
  
  lao-web-2:
    # ... configuration
  
  load-balancer:
    # Configure nginx/HAProxy to distribute traffic
```

### Database Scaling

```
Single DB (< 50k users) → Read Replicas (50k-100k users) → Sharding (> 100k users)
```

### Redis Scaling

```
Single Redis (< 100k users) → Redis Cluster (100k+ users)
```

---

## Support

**Issues?**
- Check logs: `docker-compose logs`
- Review SECURITY.md for hardening
- Check ARCHITECTURE.md for system design
- Open GitHub issue with debug info

---

**Last Updated**: 2024-07-31  
**Next Review**: 2024-10-31
