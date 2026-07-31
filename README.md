# LAO - AI Learning Operating System

A production SaaS platform for personalized AI-driven learning.

## Overview

LAO is an AI Learning Operating System that takes learners from where they are today to where they want to be. The platform uses intelligent AI routing to select the best providers for each task, maintains complete user privacy and audit trails, and scales from one user to one million.

## Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript, TailwindCSS, shadcn/ui
- **Backend**: Next.js API Routes, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Auth.js (NextAuth) with email/password, Google OAuth, GitHub OAuth
- **Caching**: Redis (Upstash)
- **Deployment**: Docker, Vercel, GitHub Actions
- **Monitoring**: Structured logging, audit trails

## Project Structure

```
lao/
├── apps/
│   └── web/                    # Next.js web application
│       ├── src/
│       │   ├── app/            # App Router pages and API routes
│       │   ├── components/     # React components
│       │   ├── lib/            # Utilities and helpers
│       │   └── styles/         # Global styles
│       ├── next.config.js
│       ├── tailwind.config.ts
│       └── package.json
│
├── packages/
│   ├── ui/                     # Shared UI components (shadcn/ui)
│   ├── database/               # Prisma schema and migrations
│   ├── auth/                   # Authentication configuration
│   ├── shared/                 # Shared types and utilities
│   ├── providers/              # AI Provider registry and router
│   ├── ai-router/              # AI Router (extends providers)
│   └── config/                 # Configuration management
│
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions CI/CD pipeline
│
├── Dockerfile                  # Production Docker image
├── docker-compose.yml          # Local development environment
├── tsconfig.json               # TypeScript configuration
├── .prettierrc                 # Code formatting
└── package.json                # Workspace configuration
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL 14+
- Docker & Docker Compose (optional)

### Local Development

1. **Clone the repository**
```bash
git clone <repo>
cd patento-webhook
```

2. **Install dependencies**
```bash
pnpm install
```

3. **Setup environment**
```bash
cp .env.example .env.local
```

4. **Start PostgreSQL and Redis**
```bash
docker-compose up -d postgres redis
```

5. **Setup database**
```bash
pnpm db:generate
pnpm db:migrate
```

6. **Start development server**
```bash
pnpm dev
```

The app will be available at `http://localhost:3000`

### Using Docker Compose for Full Stack

```bash
docker-compose up
```

This starts the entire stack including PostgreSQL, Redis, and the web app.

## Development Workflow

### Running Tests

```bash
pnpm test
```

### Type Checking

```bash
pnpm type-check
```

### Linting

```bash
pnpm lint
```

### Building for Production

```bash
pnpm build
```

### Database Management

```bash
# Generate Prisma Client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Reset database (dev only)
pnpm db:reset

# Open Prisma Studio
pnpm db:studio
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/verify-email` - Verify email
- `POST /api/auth/forgot-password` - Request password reset
- `GET/POST /api/auth/[...nextauth]` - NextAuth handlers

## Database Schema

The database includes tables for:

- **Users** - User accounts and profiles
- **Accounts** - OAuth provider accounts
- **Sessions** - User sessions
- **Roles & Permissions** - Authorization system
- **AuditLogs** - Immutable event logging
- **Credits** - Usage credits tracking
- **ProviderConfigs** - AI provider configurations
- **Settings** - User preferences
- **FeatureFlags** - Feature rollout management

See `packages/database/prisma/schema.prisma` for complete schema.

## Milestone Progress

- ✅ **Milestone 1: Authentication** - Complete
  - Email/Password authentication
  - Google OAuth
  - GitHub OAuth
  - Email verification
  - Password reset
  - Audit logging

- 🔄 **Milestone 2: Database** - In progress
- ⏳ **Milestone 3: Dashboard** - Upcoming
- ⏳ **Milestone 4: Onboarding** - Upcoming
- ⏳ **Milestone 5: AI Router** - Upcoming

## Security

The platform implements:

- **OWASP Top 10** compliance
- **Password hashing** with bcrypt (12 rounds)
- **Rate limiting** on authentication endpoints
- **CSRF** protection with NextAuth
- **XSS** protection via React/Next.js
- **SQL Injection** prevention via Prisma ORM
- **Environment variable validation** on startup
- **Immutable audit logging** for all critical actions
- **Session management** with JWT tokens
- **Role-based access control** (RBAC)

## Deployment

### Production Build

```bash
docker build -t lao:latest .
docker run -p 3000:3000 lao:latest
```

### Vercel Deployment

```bash
vercel deploy
```

Set required environment variables in Vercel dashboard:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `GOOGLE_CLIENT_ID` (optional)
- `GOOGLE_CLIENT_SECRET` (optional)
- `GITHUB_CLIENT_ID` (optional)
- `GITHUB_CLIENT_SECRET` (optional)

## CI/CD Pipeline

GitHub Actions workflow (`/.github/workflows/ci.yml`) runs on every push:

1. **Lint** - ESLint checks
2. **Type Check** - TypeScript compilation
3. **Build** - Full application build
4. **Test** - Jest test suite
5. **Code Quality** - No TODO/FIXME comments allowed

The pipeline must pass before merging to main.

## Documentation

- [Architecture Overview](./docs/ARCHITECTURE.md) - System design
- [Provider Registry](./docs/PROVIDER_REGISTRY.md) - Available providers
- [Implementation Guide](./docs/IMPLEMENTATION_GUIDE.md) - Build guide

## Contributing

1. Create feature branch from the designated development branch
2. Make changes following coding standards (see below)
3. Run full test suite locally
4. Push to branch
5. Create pull request
6. Wait for CI/CD to pass
7. Code review
8. Merge only after approval

## Coding Standards

✅ **Required**
- No `any` types - use strict TypeScript
- No TODO/FIXME comments - complete implementation
- No placeholder code - everything production-ready
- All functions documented
- All public APIs typed
- Tests for new features
- No code duplication

❌ **Not Allowed**
- Console.log for errors - use structured logging
- Catch-all error handlers
- Hardcoded secrets
- Unused code
- Browser-only code in server components

## Support

For questions or issues, contact the development team.

## License

Proprietary - LAO Platform
