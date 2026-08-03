# IrisKey Platform

Production SaaS platform infrastructure for multi-product AI ecosystems. LAO (AI Learning Operating System) is the first product built on IrisKey Platform.

## Vision

**Build once, use everywhere.**

The IrisKey Platform provides reusable, production-grade infrastructure that enables multiple products to share:

- **Authentication** - Multi-provider auth (email/password, Google, GitHub, IrisKey biometrics)
- **Database** - Multi-tenant schema with product isolation
- **Credits & Billing** - Usage tracking and subscription management
- **AI Routing** - Intelligent provider selection (Claude, GPT, Gemini, etc)
- **Notifications** - Email, SMS, push notifications
- **Analytics** - Event tracking and metrics
- **Audit Logging** - Immutable compliance logs
- **File Storage** - S3-compatible storage
- **Search** - Full-text search capabilities

Products use these packages without coupling to product-specific logic.

## Architecture

```
IrisKey Platform
├── packages/iriskey/           ← Platform infrastructure (reusable)
│   ├── auth                    # Multi-product authentication
│   ├── database                # Multi-tenant database
│   ├── shared                  # Common types & errors
│   ├── providers               # AI provider registry
│   ├── credits/                # [Coming] Usage tracking
│   ├── payments/               # [Coming] Billing
│   ├── notifications/          # [Coming] Email/SMS/push
│   ├── analytics/              # [Coming] Event tracking
│   ├── audit/                  # [Coming] Audit logging
│   ├── files/                  # [Coming] File storage
│   ├── email/                  # [Coming] Email delivery
│   └── search/                 # [Coming] Full-text search
│
├── apps/                       ← Products
│   └── lao-web                 # LAO (Learning OS) - First product
│
└── packages/lao/               ← LAO-specific packages
    └── ui                      # LAO design system & components
```

## Package Principles

**Platform Packages** (`@iriskey/*`)
- Zero product-specific logic
- Multi-tenant by design
- Reusable across any product
- Configuration-driven behavior
- Full documentation and examples

**Product Packages** (`apps/*`, `packages/lao/*`)
- Use only platform packages
- Implement product-specific features
- Can be deployed independently
- Shareable via monorepo or separate repos

## Milestone 1: Authentication

**Status**: Complete ✅

### Deliverables

**Platform**
- ✅ `@iriskey/auth` - Multi-product authentication system
- ✅ `@iriskey/database` - Multi-tenant PostgreSQL schema
- ✅ `@iriskey/shared` - Shared types and errors
- ✅ `@iriskey/providers` - AI provider infrastructure

**Product**
- ✅ `lao-web` - LAO authentication UI
- ✅ `@lao/ui` - LAO component library

### Features

**Authentication Methods**
- Email/Password with bcrypt hashing
- Google OAuth 2.0
- GitHub OAuth 2.0
- Architecture ready for IrisKey biometrics

**Database**
- PostgreSQL with Prisma ORM
- Multi-tenant schema (product isolation)
- Tables: Users, Profiles, Accounts, Sessions, Roles, Permissions, AuditLogs, Credits, Settings, FeatureFlags, ProviderConfigs

**Security**
- OWASP Top 10 compliant
- JWT-based stateless sessions
- Secure password hashing (bcrypt 12 rounds)
- Immutable audit logging with product tracking
- Email verification tokens
- Password reset tokens

**CI/CD**
- GitHub Actions on every commit
- Linting, type checking, building, testing
- No TODOs or placeholders allowed
- Docker multi-stage builds

## Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript, TailwindCSS, shadcn/ui
- **Backend**: Next.js API Routes, TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: Auth.js (NextAuth.js)
- **Testing**: Jest
- **Deployment**: Docker, Vercel, GitHub Actions
- **Monorepo**: Yarn/pnpm workspaces with Turbo

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL 14+
- Docker & Docker Compose (optional)

### Local Development

```bash
# Clone and install
git clone <repo>
cd iriskey-platform
pnpm install

# Setup environment
cp .env.example .env.local

# Start database
docker-compose up -d postgres redis

# Setup database
pnpm db:generate
pnpm db:migrate

# Start development server
pnpm dev
```

Access LAO at `http://localhost:3000`

### Using Docker Compose

```bash
docker-compose up
```

Starts entire stack: PostgreSQL, Redis, and LAO web app.

## Development Workflow

### Standard Commands

```bash
# Install dependencies across all packages
pnpm install

# Development mode (all apps)
pnpm dev

# Build all packages
pnpm build

# Type checking
pnpm type-check

# Linting
pnpm lint

# Testing
pnpm test

# Format code
pnpm format
```

### Database Commands

```bash
# Generate Prisma Client
pnpm db:generate

# Create and run migrations
pnpm db:migrate

# Open Prisma Studio (GUI)
pnpm db:studio

# Reset database (dev only)
pnpm db:reset
```

### Working with Packages

```bash
# Run command in specific package
pnpm -F @iriskey/auth build
pnpm -F lao-web dev

# Add dependency to package
pnpm -F @iriskey/auth add axios
```

## Production Deployment

### Docker

```bash
# Build image
docker build -t iriskey-platform:latest .

# Run container
docker run -p 3000:3000 iriskey-platform:latest
```

### Vercel

```bash
# Deploy LAO
vercel deploy apps/lao-web
```

Set required env vars:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (optional)
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (optional)

## Using Platform Packages

### Authentication

```typescript
// In any product's Next.js server
import { createAuthConfig } from '@iriskey/auth';

const authConfig = createAuthConfig({
  prisma,
  productId: 'my-product',
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
});
```

### Database

```typescript
// Get Prisma Client
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const users = await prisma.user.findMany();
```

### Providers (AI Router)

```typescript
import { ProviderRegistry, AIRouter } from '@iriskey/providers';

const registry = new ProviderRegistry();
const router = new AIRouter(registry, costCalculator);

// Route to best provider
const provider = await router.selectProvider(
  ProviderType.LLM,
  'chat',
  { inputTokens: 100 }
);
```

## API Endpoints (LAO)

### Authentication

- `POST /api/auth/register` - Register user
- `POST /api/auth/verify-email` - Verify email
- `POST /api/auth/forgot-password` - Password reset
- `GET/POST /api/auth/[...nextauth]` - NextAuth handlers

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Complete system design
- [ROADMAP.md](./ROADMAP.md) - Milestone planning (Milestones 1-12)

## Next Milestones

**Milestone 2**: Dashboard & Database Optimization
- User dashboard
- Profile management
- Settings interface
- Performance tuning

**Milestone 3**: Onboarding Flow
- Learning goal assessment
- Skill evaluation
- Personalization

**Milestone 4**: AI Router Foundation
- Provider health monitoring
- Cost optimization
- Metrics collection

**Milestone 5**: First AI Provider
- Claude integration
- Chat interface
- Token tracking

**Milestone 6+**: Credits, Content, Community, Marketplace, Mobile, Enterprise

## Security

**Passwords**
- bcrypt hashing (12 rounds, ~100ms per hash)
- No plaintext storage
- Constant-time comparison

**Sessions**
- JWT-based (stateless)
- 30-day max age
- HTTP-only cookies
- SameSite=Lax

**API**
- Rate limiting ready
- CSRF protection
- XSS prevention
- SQL injection protection (Prisma ORM)

**Audit**
- Immutable logs
- Product tracking
- Action logging
- User accountability

## Testing

Platform packages designed for testing:

```bash
# Run all tests
pnpm test

# With coverage
pnpm test --coverage

# Watch mode
pnpm test --watch
```

## Contributing

1. Create feature branch
2. Make changes (no TODOs!)
3. Run tests locally
4. Push to branch
5. Create PR
6. CI/CD must pass
7. Code review
8. Merge

## Coding Standards

✅ **Required**
- No `any` types
- No TODO/FIXME comments
- Complete implementations
- All functions documented
- Tests for new features
- Strict TypeScript

❌ **Not Allowed**
- Console.log for errors
- Catch-all handlers
- Hardcoded secrets
- Unused code
- Browser code in server

## Support

For questions about:
- **IrisKey Platform**: Contact platform team
- **LAO Product**: Contact LAO team
- **Development**: See Contributing above

## License

Proprietary - IrisKey Platform

---

## Quick Links

- [Authentication](./packages/iriskey/auth/src)
- [Database Schema](./packages/iriskey/database/prisma/schema.prisma)
- [Providers](./packages/iriskey/providers/src)
- [LAO Web App](./apps/lao-web/src)
- [Architecture Doc](./ARCHITECTURE.md)
- [Roadmap](./ROADMAP.md)
