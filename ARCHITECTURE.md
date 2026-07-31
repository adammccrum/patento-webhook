# IrisKey Platform Architecture

## Overview

The IrisKey Platform is a reusable, production-grade SaaS infrastructure designed to power multiple AI products from a single codebase. It provides:

- **Authentication** - Multi-provider, multi-product (email/password, Google, GitHub, future: biometrics)
- **Database** - Multi-tenant PostgreSQL with product isolation
- **Credits** - Usage tracking and monthly reset management
- **Audit Logging** - Immutable logs for compliance and debugging
- **Analytics** - Event tracking and metrics
- **Notifications** - Email, SMS, push notifications
- **Billing** - Subscriptions and payment processing
- **AI Router** - Intelligent provider selection and cost optimization

**Product Agnostic**: Platform packages contain zero product-specific logic. Each package accepts configuration (product ID, database client, etc.) and works identically for any product.

## Design Principles

1. **Platform-First Architecture** - Build reusable infrastructure, not single products
2. **Multi-Tenancy** - Single database, multiple products, perfect isolation via productId
3. **Scalability** - Supports millions of concurrent users across multiple products
4. **Security** - OWASP Top 10 compliant, encrypted, fully audited
5. **Modularity** - Each subsystem independently deployable and testable
6. **Configuration Over Code** - Product behavior via environment variables, not code changes
7. **Observability** - Complete audit trails, metrics, structured logging
8. **Type Safety** - Strict TypeScript, no any types, complete type coverage

## Repository Structure

```
iriskey-platform/
├── apps/                          # Product applications
│   └── lao-web/                  # LAO (Learning OS) - First product
│       ├── src/
│       │   ├── app/              # Next.js App Router
│       │   │   ├── api/          # API endpoints (using platform packages)
│       │   │   ├── dashboard/    # Product-specific UI
│       │   │   ├── profile/
│       │   │   ├── settings/
│       │   │   ├── credits/
│       │   │   └── layout.tsx
│       │   ├── lib/              # Product-specific utilities
│       │   │   └── auth.ts       # Auth initialization
│       │   └── middleware.ts     # Route protection
│       └── package.json
│
├── packages/                       # Reusable platform infrastructure
│   ├── iriskey/                   # Platform packages (@iriskey/*)
│   │   ├── auth/                 # Authentication (✅ Implemented)
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── config.ts     # createAuthConfig factory
│   │   │   │   ├── providers/    # Email/Password, Google, GitHub
│   │   │   │   └── crypto.ts     # Password hashing utilities
│   │   │   └── package.json
│   │   │
│   │   ├── database/              # Database schema & migrations (✅ Implemented)
│   │   │   ├── prisma/
│   │   │   │   ├── schema.prisma # Multi-tenant schema
│   │   │   │   └── migrations/   # Indexed queries for scale
│   │   │   └── package.json
│   │   │
│   │   ├── shared/                # Common types & errors (✅ Implemented)
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── errors.ts     # AuthError, ValidationError, NotFoundError
│   │   │   │   ├── types.ts      # ApiResponse, UserSession, etc
│   │   │   │   └── utils.ts      # Common utilities
│   │   │   └── package.json
│   │   │
│   │   ├── providers/             # AI provider registry & router (✅ Implemented)
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── types.ts      # IProvider, ProviderType enums
│   │   │   │   ├── registry.ts   # Provider registration
│   │   │   │   ├── router.ts     # Intelligent selection
│   │   │   │   └── cost-calculator.ts
│   │   │   └── package.json
│   │   │
│   │   ├── config/                # (✅ Implemented) Centralized configuration
│   │   │   ├── src/
│   │   │   │   └── index.ts      # Zod validation, env parsing, singleton pattern
│   │   │   └── package.json
│   │   │
│   │   ├── middleware/            # (✅ Implemented) Reusable API middleware
│   │   │   ├── src/
│   │   │   │   └── index.ts      # withErrorHandler, ApiResponseBuilder, validation
│   │   │   └── package.json
│   │   │
│   │   ├── contracts/             # (✅ Implemented) Shared types and DTOs
│   │   │   ├── src/
│   │   │   │   └── index.ts      # ApiResponse, UserSession, AuditLogEntry, etc
│   │   │   └── package.json
│   │   │
│   │   ├── audit/                 # (✅ Implemented) Immutable audit logging
│   │   │   ├── src/
│   │   │   │   └── index.ts      # AuditService singleton, event emission
│   │   │   └── package.json
│   │   │
│   │   ├── events/                # (✅ Implemented) Event-driven architecture
│   │   │   ├── src/
│   │   │   │   └── index.ts      # EventEmitter, 15+ event types
│   │   │   └── package.json
│   │   │
│   │   ├── notifications/         # (PLANNED) Email/SMS/push
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── email.ts
│   │   │   │   ├── sms.ts
│   │   │   │   └── templates/
│   │   │   └── package.json
│   │   │
│   │   ├── analytics/             # (PLANNED) Event tracking
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── tracker.ts
│   │   │   │   └── types.ts
│   │   │   └── package.json
│   │   │
│   │   └── billing/               # (PLANNED) Subscriptions & payments
│   │       ├── src/
│   │       │   ├── index.ts
│   │       │   ├── service.ts
│   │       │   └── types.ts
│   │       └── package.json
│   │
│   └── lao/                        # LAO-specific packages
│       └── ui/                    # LAO design system & components
│           ├── src/
│           │   ├── index.ts
│           │   ├── components/
│           │   ├── hooks/
│           │   └── utils/
│           └── package.json
│
├── ARCHITECTURE.md                # This file
├── PLATFORM.md                    # Platform concepts and usage
├── README.md                      # Getting started
├── ROADMAP.md                     # Milestones 1-14
├── TECHNICAL_DEBT.md              # Issues and recommendations
├── package.json                   # Root workspaces config
└── pnpm-workspace.yaml            # pnpm configuration
```

## Package Dependencies

```
@iriskey/shared
  ↑ (no dependencies)

@iriskey/database
  ├─ @prisma/client
  └─ prisma (dev)

@iriskey/auth
  ├─ @auth/core
  ├─ @auth/prisma-adapter
  ├─ @prisma/client
  ├─ @iriskey/database
  └─ bcryptjs

@iriskey/providers
  └─ @iriskey/shared

@iriskey/config
  ├─ @iriskey/shared
  └─ zod (validation)

@iriskey/audit
  ├─ @iriskey/database
  ├─ @iriskey/shared
  └─ @iriskey/config

@iriskey/credits
  ├─ @iriskey/database
  ├─ @iriskey/shared
  └─ @iriskey/config

(other packages follow similar pattern)

lao-web (app)
  ├─ next
  ├─ react
  ├─ next-auth
  ├─ @iriskey/auth
  ├─ @iriskey/database
  ├─ @iriskey/shared
  ├─ @iriskey/providers
  ├─ @iriskey/config (when available)
  └─ @lao/ui
```

## Multi-Tenancy Design

### Shared Data (Global across all products)

**Users** - One account per email, works on all products
```sql
User(id, email, name, image, emailVerified, createdAt)
```

**Sessions** - JWT tokens valid across products
```sql
Session(id, sessionToken, userId, expires)
```

**Accounts** - OAuth provider links (Gmail, GitHub account)
```sql
Account(userId, provider, providerAccountId, type)
```

### Product-Scoped Data

**AuditLog** - Tracks which product performed action
```sql
AuditLog(id, userId, productId, action, resource, details, createdAt)
-- Index: (productId, userId, createdAt DESC)
-- Index: (productId, action, createdAt DESC)
```

**ProviderConfig** - Each product has own provider config
```sql
ProviderConfig(productId, name, config, secrets)
-- Unique: (productId, name)
```

**FeatureFlag** - Product-specific feature toggles
```sql
FeatureFlag(productId, name, enabled)
-- Unique: (productId, name)
```

**Credits** - User's AI usage per product (can be extended)
```sql
Credits(userId, balance, spent, monthlyReset, lastResetDate)
-- Today: Shared across products
-- Future: Can be product-specific with migration
```

## Authentication Architecture

### Factory Pattern

Products don't include auth code—they configure it:

```typescript
// apps/lao-web/src/lib/auth.ts
import { createAuthConfig } from '@iriskey/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient(); // Singleton

const authConfig = createAuthConfig({
  prisma,                          // Product passes its client
  productId: 'lao',               // Which product is this?
  pages: {
    signIn: '/auth/login',        // Custom redirect URLs
    callbackUrl: '/dashboard',
  },
});

export const { auth, signIn, signOut, handlers } = NextAuth(authConfig);
```

### Platform Guarantees

`createAuthConfig()` ensures:
- JWT tokens include `productId` field (for audit/authorization)
- All login/logout events logged with `productId`
- Passwords secured via bcrypt (12 rounds)
- Sessions expire after 30 days
- Email verification workflow
- Password reset tokens with 1-hour expiry

### Product Customization

Products CAN customize:
- Login page URLs
- Redirect targets
- OAuth provider selection (via feature flags)
- Credential validators (email format, password rules)

Products CANNOT customize:
- JWT algorithm, signing key, or structure
- Password hashing method or rounds
- Session timeout or refresh logic
- Audit logging format

## API Endpoint Patterns

### Current Pattern (Milestone 2.5, Now Implemented)

All routes now follow standardized pattern:

1. ✅ Use singleton Prisma client via `db` from `lib/db`
2. ✅ Auth injection via `requireAuth()` + `withErrorHandler`
3. ✅ Validation with Zod schema via `validateRequest()`
4. ✅ Error handling via `withErrorHandler` middleware wrapper
5. ✅ Response formatting via `ApiResponseBuilder.success/error`
6. ✅ Audit logging via `getAuditService()`
7. ✅ Product ID injection via `ctx.productId` from config
8. ✅ Context passing: `RouteContext` with userId, productId, ipAddress

```typescript
// Implemented pattern (all current routes)
import { withErrorHandler, ApiResponseBuilder, authError, toResponse } from '@iriskey/middleware';
import { getAuditService } from '@iriskey/audit';
import { db } from '@/lib/db';

export const PUT = withErrorHandler(async (request: NextRequest, ctx) => {
  const session = await requireAuth();
  const userId = session.user?.id;

  if (!userId) {
    return authError();
  }

  const body = await request.json();
  const validation = updateSchema.safeParse(body);

  if (!validation.success) {
    return validationError(validation.error.errors[0].message);
  }

  const updated = await db.resource.update({
    where: { id: userId },
    data: validation.data,
  });

  const auditService = getAuditService();
  await auditService.logResourceUpdated(userId, ctx.productId, Object.keys(validation.data));

  return toResponse(ApiResponseBuilder.success(updated), 200);
});
```

**Benefits**:
- ✅ No code duplication across routes
- ✅ Single Prisma instance (connection pooling)
- ✅ Centralized error handling (consistent error codes)
- ✅ Consistent response format (success/error envelope)
- ✅ Audit logging guaranteed (no manual prisma.auditLog.create)
- ✅ No hardcoded product IDs (uses config injection)
- ✅ Type-safe contracts (shared DTOs in @iriskey/contracts)

### Future Pattern (Milestone 3+)

Refactor to service/repository layer pattern:

```typescript
// Future target (post-Milestone 3)
import { withErrorHandler } from '@iriskey/middleware';
import { profileService } from '@iriskey/services';

export const GET = withErrorHandler(async (req, ctx) => {
  const profile = await profileService.getProfile(ctx.userId, ctx.productId);
  return ApiResponse.success(profile);
});
```

## Configuration Management

### Environment Variables

**Shared** (all products):
```bash
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."
NEXTAUTH_SECRET="..."
```

**Product-Specific** (per app):
```bash
# lao-web
PRODUCT_ID="lao"
NEXT_PUBLIC_APP_NAME="LAO"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

### Feature Flags

Instead of code changes, use database feature flags:

```sql
INSERT INTO FeatureFlag (productId, name, enabled) VALUES
  ('lao', 'enable_ai_router', true),
  ('lao', 'enable_two_factor_auth', false),
  ('future-product', 'enable_ai_router', false);
```

Products check flags:
```typescript
const isRouterEnabled = await featureFlags.isEnabled('enable_ai_router', 'lao');
```

## Scalability Considerations

### Database

**Current**: Single PostgreSQL instance

**Optimizations** (as users scale):
1. Read replicas for analytics queries
2. Connection pooling via PgBouncer
3. Sharding by productId if needed
4. Archival of old audit logs

**Indexes** (migration 001):
- `idx_users_created_at` - Dashboard queries
- `idx_audit_logs_user_product_created` - User activity
- `idx_audit_logs_product_action_created` - Product-wide metrics
- `idx_sessions_expires` - Session cleanup
- `idx_credits_updated_at` - Monthly reset queries

### API Servers

**Current**: Single Next.js instance

**Optimizations**:
1. Deploy multiple instances behind load balancer
2. Stateless JWT auth - no session store needed
3. Redis caching for feature flags, provider health
4. CDN for static assets

### Caching Strategy

**Session**: HTTP-only cookies, no backend lookup
**Provider Health**: Redis TTL 5 minutes
**Feature Flags**: Redis TTL 1 hour
**User Profiles**: Client-side cache, TTL 5 minutes

## Security Architecture

### Authentication

- **Passwords**: bcrypt 12 rounds (~100ms), constant-time comparison
- **Sessions**: JWT signed with NEXTAUTH_SECRET, 30-day expiry
- **Cookies**: HTTP-only, SameSite=Lax, Secure in production
- **OAuth**: PKCE flow, state tokens, client secret validation

### Authorization

- **Users**: Can only access own profile, settings, credits
- **Products**: Isolated by productId, no cross-product leakage
- **Roles**: (Future) Admin, moderator, user roles per product
- **Audit**: All actions logged, immutable, with userId + productId

### Data Protection

- **Passwords**: Never logged, never cached
- **Secrets**: Environment variables only, encrypted at rest
- **Tokens**: Signed and encrypted before transmission
- **Database**: PostgreSQL encryption at rest (future)

## API Response Format

**Standard Success**:
```json
{
  "success": true,
  "data": { /* response data */ }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_EMAIL",
    "message": "Email format is invalid",
    "details": { }
  }
}
```

## Testing Strategy

### Platform Packages

Test in isolation with mock Prisma:
```typescript
const mockPrisma = { /* mock */ };
const config = createAuthConfig({
  prisma: mockPrisma,
  productId: 'test-product'
});
```

### Product Integration

Test product with real platform packages:
```typescript
const authConfig = createAuthConfig({
  prisma: testDatabase,
  productId: 'lao'
});
// Test login flow end-to-end
```

## Monitoring & Observability

### Audit Logs

Query per product:
```sql
SELECT * FROM AuditLog 
WHERE productId = 'lao' 
AND createdAt > NOW() - INTERVAL '24 hours'
ORDER BY createdAt DESC;
```

### Metrics

Each package emits metrics:
- `auth.signin` - Login attempt
- `auth.register` - New user
- `auth.failed_login` - Failed attempt
- `credits.deducted` - AI usage
- `api.request_duration` - Performance

### Structured Logging

All platform code logs with context:
```
[2024-07-31T10:05:00Z] auth.signin productId=lao userId=user123 provider=google duration=245ms
```

## Adding a New Product

1. Create product folder: `apps/my-product-web`
2. Use platform packages with config:
   ```typescript
   const authConfig = createAuthConfig({
     prisma,
     productId: 'my-product',
     pages: { /* custom URLs */ }
   });
   ```
3. Add product to database:
   ```sql
   INSERT INTO Product (id, name) VALUES ('my-product', 'My Product');
   ```
4. Deploy independently - no platform changes needed

## Adding a New Platform Package

1. Create in `packages/iriskey/new-feature`
2. Make zero assumptions about products
3. Accept productId, config, and Prisma client as parameters
4. Update path aliases in tsconfig.json
5. Update pnpm-workspace.yaml
6. Document in README

## Roadmap Progress

**✅ Phase 1 Complete**: Authentication, Database, Providers (Milestone 1)
- ✅ @iriskey/auth - Multi-provider authentication
- ✅ @iriskey/database - Multi-tenant schema & singleton pattern
- ✅ @iriskey/shared - Common types
- ✅ @iriskey/providers - AI router

**✅ Phase 2 Complete**: Platform Stabilization (Milestone 2.5)
- ✅ @iriskey/config - Environment & feature flag management
- ✅ @iriskey/middleware - Reusable API middleware (withErrorHandler, ApiResponseBuilder)
- ✅ @iriskey/contracts - Shared types and DTOs (single source of truth)
- ✅ @iriskey/audit - Audit logging service with event emission
- ✅ @iriskey/events - Event-driven architecture with 15+ event types
- ✅ All API routes refactored to use new packages
- ✅ Singleton Prisma client across application
- ✅ Centralized error handling and response formatting
- ✅ No hardcoded product identifiers

**📋 Phase 3 (Milestone 3-4)**: Advanced Features
- [ ] @iriskey/notifications - Email/SMS/push
- [ ] @iriskey/analytics - Event tracking with metrics
- [ ] @iriskey/billing - Subscriptions & payments
- [ ] AI Router enhancement

**📋 Phase 4 (Milestone 5-8)**: Scale & Multi-Product
- [ ] @iriskey/files - S3 file storage
- [ ] @iriskey/email - Email delivery service
- [ ] @iriskey/search - Full-text search
- [ ] Second product launch
- [ ] Database read replicas & connection pooling

## Decisions Log

| Decision | Rationale | Status | Implications |
|----------|-----------|--------|--------------|
| Single shared Prisma instance (getPrisma) | Reduces connection overhead, eliminates connection pooling issues | ✅ Implemented (M2.5) | All routes use singleton via lib/db.ts |
| JWT sessions, not database sessions | Stateless, scales to multiple servers | ✅ Implemented | Must use NEXTAUTH_SECRET for signing |
| @iriskey/* packages over @lao/* | Platform can be reused for future products | ✅ Implemented | Requires no product-specific logic in packages |
| Product ID injection via @iriskey/config | Config as dependency injection, not hardcoded | ✅ Implemented (M2.5) | All routes receive ctx.productId from middleware |
| Standardized API response format | Consistent success/error envelope across all endpoints | ✅ Implemented (M2.5) | Clients can parse responses uniformly |
| Centralized audit logging service | Single AuditService instead of manual prisma.auditLog.create | ✅ Implemented (M2.5) | Guarantees audit logging doesn't get skipped |
| Event-driven architecture | Decouple services via events (audit, analytics, notifications) | ✅ Implemented (M2.5) | Future services subscribe to events, no coupling |
| Immutable audit logs | Compliance and debugging | ✅ Implemented | Never update/delete audit logs |
| RouteContext pattern | Inject userId, productId, ipAddress to all handlers | ✅ Implemented (M2.5) | withErrorHandler provides ctx automatically |
| withErrorHandler wrapper | Centralized error handling, guaranteed auth check | ✅ Implemented (M2.5) | All routes use same error handling pattern |

## Completed Work (Milestone 2.5)

✅ **Singleton Database Pattern**
- Created @iriskey/database/src with getPrisma() singleton
- lib/db.ts wrapper for application-level access
- No more `new PrismaClient()` scattered across routes

✅ **Configuration Management**
- Created @iriskey/config with Zod-validated env parsing
- Configuration class with singleton pattern
- getProductId(), getProductName(), etc. functions
- Support for: PRODUCT_ID, NODE_ENV, DATABASE_URL, NEXTAUTH_SECRET, etc.

✅ **API Response Standardization**
- Created ApiResponseBuilder with success(), error(), paginated()
- Consistent response envelope (success/error + data)
- toResponse() utility for converting to NextResponse
- statuscode mapping: 200 (success), 400 (validation), 401 (auth), 404 (not found), 500 (server)

✅ **Error Handling Middleware**
- Created withErrorHandler wrapper for all routes
- Centralized try/catch and error transformation
- RouteContext injection (userId, productId, session, ipAddress, userAgent)
- Helper functions: authError(), validationError(), notFoundError(), serverError()

✅ **Shared Type Contracts**
- Created @iriskey/contracts with all DTOs
- ApiResponse<T>, ApiError, PaginatedResponse<T>
- UserSession, UserProfile, UserSettings, UserCredits
- AuditLogEntry with AuditAction enum (16 actions)
- RequestValidator types for Zod validation

✅ **Audit Logging Service**
- Created AuditService singleton with initialize/getInstance
- Methods: logUserRegistered, logEmailVerified, logPasswordReset, logProfileUpdated, logSettingsUpdated, logCreditsUsed
- Query methods: getUserLogs(), getProductLogs(), getActionLogs()
- Integration with event system for audit event emission

✅ **Event-Driven Architecture**
- Created @iriskey/events with EventEmitter class
- 15+ event types: UserRegisteredEvent, EmailVerifiedEvent, CreditsUsedEvent, etc.
- getEventEmitter(), onEvent(), emitEvent() functions
- Future services can subscribe without coupling

✅ **API Route Refactoring**
- /api/auth/register - Uses withErrorHandler, ApiResponseBuilder, getAuditService()
- /api/auth/verify-email - Centralized auth + error handling, audit logging
- /api/auth/forgot-password - Security-conscious (no user enumeration), audit logging
- /api/profile (GET/PUT) - Parallel queries, standardized responses, audit logging
- /api/dashboard - Comprehensive dashboard data, calculated credits, recent activity
- /api/settings (GET/PUT) - Settings management with audit logging
- /api/credits (GET) - Credits endpoint with usage history filtering by productId

✅ **Application Initialization**
- Added initializeAudit(db) to lib/auth.ts
- Configuration auto-initializes via Configuration.getInstance()
- Ensures AuditService ready before any routes execute

✅ **Environment Configuration**
- Updated .env.example with PRODUCT_ID, PRODUCT_NAME
- Added DB_MAX_CONNECTIONS, DB_MIN_CONNECTIONS
- Documented all config variables with descriptions

## Next Architectural Steps

1. **Milestone 3 (Verification & Documentation)**:
   - ✅ Run type checker: `tsc --noEmit`
   - ✅ Run linter: `eslint src --max-warnings 0`
   - ✅ Create PLATFORM_HEALTH_REPORT.md with metrics
   - ✅ Document event subscriptions for future services
   - ✅ Test all endpoints manually or with curl/Postman

2. **Milestone 4 (Service Layer Abstraction)**:
   - Extract business logic from routes into service classes
   - Create @iriskey/services package with ProfileService, SettingsService, CreditsService
   - Maintain same API contracts, same response format
   - No behavioral changes, pure refactoring

3. **Milestone 5 (Remaining Packages)**:
   - @iriskey/notifications - Email/SMS/push integration
   - @iriskey/analytics - Event tracking with metrics
   - @iriskey/billing - Subscriptions & payments (Stripe)

4. **Milestone 6+**: Scale & Multi-Product
   - Additional products launch using same platform packages
   - Database optimization: read replicas, connection pooling via PgBouncer
   - Performance monitoring: APM integration (DataDog, New Relic, etc.)

See TECHNICAL_DEBT.md for resolved issues and PLATFORM_HEALTH_REPORT.md for current state.
