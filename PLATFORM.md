# IrisKey Platform Architecture

## Overview

IrisKey Platform is reusable SaaS infrastructure designed to power multiple AI products. It provides core capabilities that products use without modification:

- Authentication (multi-provider, multi-product)
- Database (multi-tenant schema)
- AI routing and provider management
- Credits and usage tracking
- Notifications (email, SMS, push)
- Analytics and metrics
- Audit logging and compliance
- File storage
- Search capabilities

## Core Principle: Product Agnostic

The platform contains **zero product-specific logic**. Every package works identically whether used by LAO, IrisKey.ai, or future products.

Example: `@iriskey/auth` doesn't know it's being used by LAO. It provides authentication capabilities. LAO configures it via `productId: 'lao'`.

## Package Structure

### Platform Packages (`packages/iriskey/`)

Reusable infrastructure packages used by all products.

#### @iriskey/auth

**Purpose**: Multi-product, multi-provider authentication

**Key Concepts**:
- `createAuthConfig(options)` - Factory function products call with their Prisma client
- Supports email/password, Google, GitHub, extensible to any provider
- JWT sessions (stateless, no database bottleneck)
- Product ID tracked in tokens and audit logs

**Product Usage**:
```typescript
import { createAuthConfig } from '@iriskey/auth';

const authConfig = createAuthConfig({
  prisma,           // Product's Prisma client
  productId: 'lao', // Which product is using this
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
});
```

**No Product Logic**:
- Doesn't know LAO exists
- Doesn't redirect to LAO's dashboard
- Doesn't import LAO packages
- Doesn't include LAO-specific features

#### @iriskey/database

**Purpose**: Multi-tenant PostgreSQL schema via Prisma ORM

**Key Concepts**:
- `Product` table for multi-tenancy
- `User` table (shared across products)
- `AuditLog` has `productId` field
- `ProviderConfig` scoped to product
- `FeatureFlag` scoped to product

**Product Usage**:
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const users = await prisma.user.findMany();
```

**Multi-Tenancy**:
- Users are global (one account works across all products)
- Feature flags per product
- Provider configs per product
- Audit logs track which product performed action

#### @iriskey/shared

**Purpose**: Common types, errors, utilities

**Exports**:
- `AuthError`, `ValidationError`, `NotFoundError`, etc.
- `ApiResponse<T>`, `PaginatedResponse<T>`
- `UserSession` interface
- `EnvConfig` interface

**No Product Logic**: Pure types and utilities.

#### @iriskey/providers

**Purpose**: AI Provider registry, router, cost calculator

**Key Concepts**:
- `IProvider` interface (LLM, Image, Video, Voice, Embedding)
- `ProviderRegistry` - manages all available providers
- `AIRouter` - selects best provider based on criteria
- `CostCalculator` - estimates costs for operations

**Product Usage**:
```typescript
const router = new AIRouter(registry, costCalculator);
const provider = await router.selectProvider(
  ProviderType.LLM,
  'chat',
  { inputTokens: 100 }
);
```

**No Product Logic**: Generic provider system.

### Platform Packages (Planned)

These will follow the same pattern:

**@iriskey/credits**
- Usage tracking per user
- Balance management
- Monthly resets
- Product-aware quotas

**@iriskey/payments**
- Billing and invoicing
- Subscription management
- Payment processing
- Revenue tracking

**@iriskey/notifications**
- Email delivery
- SMS notifications
- Push notifications
- Template system

**@iriskey/analytics**
- Event tracking
- Metrics collection
- Data aggregation
- Dashboard data

**@iriskey/audit**
- Immutable event logging
- Compliance reporting
- Change tracking
- Search and filter

**@iriskey/files**
- S3 integration
- File uploads/downloads
- Storage management
- Signed URLs

**@iriskey/email**
- Email template system
- Provider abstraction (Resend, SendGrid, etc)
- Batch sending
- Delivery tracking

**@iriskey/search**
- Elasticsearch integration
- Full-text search
- Faceted search
- Auto-indexing

### Product Packages

Products add their own packages layered on platform infrastructure.

**`packages/lao/ui`**
- LAO-specific design system
- Components (Button, Input, etc from platform UI layer)
- LAO branding
- LAO-specific layouts

**`packages/lao/[feature]`** (Future)
- LAO courses system
- LAO missions system
- LAO tutor
- Any LAO-specific feature

**`apps/lao-web`**
- LAO Next.js application
- Uses @iriskey/* platform packages
- Uses @lao/* product packages
- Implements LAO business logic

## Multi-Tenancy Design

### Shared Data

These are shared across all products:
- `User` - One account per email
- `Profile` - User's shared profile
- `Account` - OAuth connections (shared)
- `Session` - User sessions
- `Role`, `Permission` - Authorization (can be product-scoped in future)
- `Credits` - User's usage credits (can be product-specific in future)

### Product-Scoped Data

These are per-product:
- `ProviderConfig` - Product can have different providers
- `FeatureFlag` - Product can have different features
- `AuditLog` - Includes productId for tracking

### Future Enhancements

**Per-Product Credits**: Different daily/monthly allowances per product
**Per-Product Settings**: Product-specific user settings
**Per-Product Roles**: Roles scoped to products

## Authentication Flow

### 1. Product Initializes Auth

```typescript
// apps/lao-web/src/lib/auth.ts
import { createAuthConfig } from '@iriskey/auth';

const authConfig = createAuthConfig({
  prisma,
  productId: 'lao',
  pages: { ... }
});

export const { auth, signIn, signOut } = NextAuth(authConfig);
```

### 2. User Signs Up

```
User fills form (LAO UI)
  ↓
POST /api/auth/register (LAO endpoint)
  ↓
@iriskey/auth validates & hashes password
  ↓
Prisma creates User in shared database
  ↓
Audit log: productId='lao', action='user_registered'
  ↓
Email verification sent
```

### 3. User Signs In

```
User enters email/password or clicks OAuth (LAO UI)
  ↓
NextAuth delegates to @iriskey/auth provider
  ↓
@iriskey/auth verifies credentials
  ↓
JWT token created with productId='lao'
  ↓
Audit log: productId='lao', action='user_signed_in'
  ↓
Redirect to /dashboard
```

### 4. Future Product Sign In

Same flow, different productId:
- `productId='future-product'` in JWT
- Audit logs track product-specific login
- Same user account works across products

## Extensibility

### Adding a New Product

1. Create product folder: `apps/my-product-web`
2. Use @iriskey/* packages
3. Set productId in createAuthConfig
4. Add product to database: `INSERT INTO Product (name, id) VALUES ('my-product', 'my-product')`
5. Deploy independently

**Key**: No changes needed to platform packages.

### Adding a New Platform Package

1. Create in `packages/iriskey/new-feature`
2. Make completely product-agnostic
3. Accept configuration/product ID as parameters
4. All products can use it immediately

**Example**: Adding `@iriskey/email`

```typescript
// packages/iriskey/email/src/index.ts
export async function sendEmail({
  to, subject, body, productId
}) {
  // No LAO-specific logic
  // Works for any product
}
```

## Configuration Management

### Environment Variables

**Shared** (all products):
- `DATABASE_URL` - Single shared database
- `NEXTAUTH_SECRET` - Platform-wide JWT secret
- `REDIS_URL` - Shared cache

**Product-Specific** (per app):
- `NEXTAUTH_URL` - Product's domain
- `NEXT_PUBLIC_APP_NAME` - Product display name
- `[PRODUCT]_FEATURE_X` - Product features

### Database Configuration

Products don't configure database - they use the shared @iriskey/database schema. Configuration via Feature Flags:

```sql
INSERT INTO FeatureFlag (productId, name, enabled)
VALUES ('lao', 'enable_ai_router', true),
       ('future-product', 'enable_ai_router', false);
```

## Deployment

### Single Monorepo

```bash
# All products in one repo (current)
pnpm install
pnpm build
docker build -t platform:latest .
```

Deploy multiple products from single image via environment variable.

### Multi-Repo (Future)

```
iriskey-platform/          # Shared packages only
  packages/iriskey/*

product-lao/               # LAO-specific
  apps/lao-web
  packages/lao/*
  (dependency: iriskey-platform)

product-future/            # Future product
  apps/future-web
  packages/future/*
  (dependency: iriskey-platform)
```

Each product has own CI/CD, deployments, but all share platform.

## Scaling Considerations

### Database

Single PostgreSQL instance shared across all products.

**Scaling Options**:
- Vertical scaling (larger instance)
- Read replicas for analytics
- Sharding by productId if needed (future)

### Authentication

Stateless JWT tokens - scale horizontally without bottleneck.

### Cache

Shared Redis for sessions, provider health, metrics.

**Per-Product Caching**: Use key prefix `${productId}:${key}`

## Testing

### Platform Packages

Test in isolation with mock data:

```typescript
// packages/iriskey/auth/__tests__/config.test.ts
const mockPrisma = { /* mock */ };
const config = createAuthConfig({
  prisma: mockPrisma,
  productId: 'test-product'
});
```

### Product Integration

Test product with real platform packages:

```typescript
// apps/lao-web/__tests__/auth.integration.test.ts
const authConfig = createAuthConfig({
  prisma: testDatabase,
  productId: 'lao'
});
```

## Security Implications

### Data Isolation

- Audit logs track productId → can query per-product activity
- Feature flags per product → no cross-product feature leaks
- Provider configs per product → each product chooses providers

### Credential Management

- Single NEXTAUTH_SECRET for all products
  - Same issuer for all JWTs
  - Token valid across platforms (by design for seamless auth)
- OAuth secrets per platform
  - Each product has own Google/GitHub apps
  - Secrets in environment variables

### Future: Product-Specific Secrets

If needed, add secrets table:
```sql
CREATE TABLE ProductSecret (
  productId STRING,
  key STRING,
  value STRING (encrypted)
);
```

## Monitoring and Observability

### Audit Logs

```sql
-- All LAO activity
SELECT * FROM AuditLog WHERE productId = 'lao'

-- All user registrations across all products
SELECT * FROM AuditLog WHERE action = 'user_registered'

-- Failed logins for specific product
SELECT * FROM AuditLog WHERE productId = 'lao' AND action = 'user_sign_in_failed'
```

### Metrics

Each platform package emits metrics:

```typescript
// @iriskey/auth emits when user signs in
emit('auth.signin', { productId: 'lao', provider: 'google' })

// Products collect and aggregate
```

### Logging

All platform code includes productId in logs:
```
[2024-07-31T10:05:00Z] auth.signin productId=lao user=user123 provider=google
```

## Cost Accounting

With multi-product infrastructure, track costs:

```sql
-- AI costs per product per month
SELECT productId, SUM(cost) FROM AIUsage 
WHERE date_trunc('month', createdAt) = current_date
GROUP BY productId;

-- Platform costs per user per product
SELECT productId, userId, SUM(cost) FROM AllUsage
WHERE date_trunc('month', createdAt) = current_date
GROUP BY productId, userId;
```

## Roadmap

**Phase 1** (Milestone 1-4): Foundation
- ✅ @iriskey/auth
- ✅ @iriskey/database
- ✅ @iriskey/shared
- ✅ @iriskey/providers

**Phase 2** (Milestone 5-8): Core Features
- [ ] @iriskey/credits
- [ ] @iriskey/payments
- [ ] @iriskey/notifications
- [ ] First provider integration (Claude)

**Phase 3** (Milestone 9-10): Expansion
- [ ] @iriskey/analytics
- [ ] @iriskey/audit
- [ ] Content delivery
- [ ] Community features

**Phase 4** (Milestone 11-12): Scale
- [ ] @iriskey/files
- [ ] @iriskey/email
- [ ] @iriskey/search
- [ ] Enterprise features
- [ ] Mobile apps

**Phase 5**: Multi-Product
- [ ] Second product on platform
- [ ] Third product
- [ ] Marketplace across products

## Summary

IrisKey Platform is a reusable, multi-product foundation that enables:

✅ **Build once** - Core infrastructure created once  
✅ **Use everywhere** - All products benefit immediately  
✅ **Isolate safely** - Products coexist without interference  
✅ **Scale easily** - Add products without platform changes  
✅ **Maintain simply** - Single source of truth for shared features  

Products focus on differentiation, platform provides commodities.
