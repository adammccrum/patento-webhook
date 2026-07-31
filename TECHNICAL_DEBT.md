# Technical Debt Report

**Date**: 2024-07-31  
**Milestone**: Post-Milestone 2 (Authentication + Dashboard complete)  
**Status**: Debt identified, refactoring roadmap defined  

## Executive Summary

The codebase has successfully established a multi-product platform foundation (Milestones 1-2). However, several architectural patterns must be refactored before continuing to Milestones 3-14. Current debt is **medium severity** and can be addressed in Milestone 3 without blockers.

**Key Findings**:
- ✅ Platform architecture is sound (zero product-specific code in @iriskey/* packages)
- ⚠️ Multiple code duplication patterns that will compound in Milestones 3+
- ⚠️ Configuration management scattered across hardcoded strings
- ⚠️ No centralized error handling or response format
- ⚠️ Prisma client management pattern needs standardization

**Estimated Impact if Unchanged**:
- **Milestone 3+**: 20-30% slower development (repeated patterns)
- **Scale to 100k users**: Potential connection pool exhaustion (multiple Prisma instances)
- **Adding new products**: Requires code duplication of middleware and patterns
- **Operational costs**: Inefficient resource usage from multiple client instances

---

## Debt Items by Severity

### 🔴 HIGH PRIORITY (Fix in Milestone 3)

#### 1. Multiple Prisma Client Instances
**Severity**: HIGH  
**Current State**: 8+ instances of `new PrismaClient()` across the codebase

**Locations**:
```
apps/lao-web/src/lib/auth.ts (line 11)
apps/lao-web/src/app/api/auth/register/route.ts (line 10)
apps/lao-web/src/app/api/dashboard/route.ts (line 10)
apps/lao-web/src/app/api/profile/route.ts (line 11)
apps/lao-web/src/app/api/settings/route.ts (line 10)
apps/lao-web/src/app/api/credits/route.ts (line 10)
+ any future endpoints
```

**Problem**:
- Each instance creates separate connection pool (TCP overhead)
- Default pool size: 10 connections per instance
- At scale (8 endpoints × 10 connections = 80 connections to 1 server)
- PostgreSQL connection limit: usually 100-200 total
- Multiplied across multiple app instances (load balancing)

**Risk if Unchanged**:
- At 50k concurrent users: Connection pool exhaustion → 503 errors
- At 100k concurrent users: Database cannot accept new connections
- Cost: Extra server resources for connection overhead

**Solution**: Create singleton pattern
```typescript
// apps/lao-web/src/lib/db.ts
let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

export default prisma;
```

**Estimated Effort**: 2-4 hours  
**Refactoring Impact**: Low - replace imports in 8 files  
**Testing**: Unit test singleton pattern, integration tests for each endpoint

---

#### 2. Hardcoded Product IDs
**Severity**: HIGH  
**Current State**: 'lao' hardcoded in 4+ places

**Locations**:
```
apps/lao-web/src/lib/auth.ts (line 15)
apps/lao-web/src/app/api/auth/register/route.ts (line 11)
apps/lao-web/src/app/api/profile/route.ts (line 122)
apps/lao-web/src/app/api/settings/route.ts (line 68)
apps/lao-web/src/app/api/credits/route.ts (line ?)
```

**Problem**:
- Cannot reuse lao-web for another product without code changes
- Breaks "platform-first" principle
- Product ID should be configuration, not code
- Makes testing harder (hardcoded values in tests)

**Risk if Unchanged**:
- New product requires forking lao-web or duplicating code
- Cannot run LAO and future product from same codebase
- Violates multi-tenancy design

**Solution**: Create @iriskey/config package + inject via env
```typescript
// .env.local
PRODUCT_ID="lao"

// apps/lao-web/src/lib/config.ts
export const PRODUCT_ID = process.env.PRODUCT_ID || 'lao';

// Usage in routes
productId: getConfig().productId
```

**Estimated Effort**: 4-6 hours (includes creating @iriskey/config)  
**Refactoring Impact**: Medium - updates 5+ locations  
**Testing**: Verify productId is injected correctly via env  

---

#### 3. Duplicated Error Handling Pattern
**Severity**: HIGH  
**Current State**: Every route has try-catch with identical structure

**Example** (from profile, dashboard, settings, credits routes):
```typescript
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ... business logic ...

    return NextResponse.json({ /* data */ });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to...' },
      { status: 500 }
    );
  }
}
```

**Problem**:
- Same pattern in 6+ routes
- Inconsistent error messages (no standard format)
- No structured logging
- No error context (userID, productId, request duration)
- Hard to add new error types (rate limit, validation, etc)

**Risk if Unchanged**:
- Adding new error types requires changes in all endpoints
- Inconsistent error format breaks client error handling
- No observability for debugging production issues
- Difficult to implement rate limiting or circuit breakers

**Solution**: Create error handling middleware
```typescript
// packages/iriskey/middleware/src/withErrorHandler.ts
export function withErrorHandler(handler: RouteHandler) {
  return async (req: NextRequest) => {
    try {
      return await handler(req);
    } catch (error) {
      return handleError(error, req);
    }
  };
}

// packages/iriskey/middleware/src/handleError.ts
function handleError(error: Error, req: NextRequest) {
  if (error instanceof ValidationError) {
    return NextResponse.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: error.message }
    }, { status: 400 });
  }
  // ... other error types
}

// Usage
export const GET = withErrorHandler(async (req) => {
  // No try-catch needed
  const data = await getProfile(userId);
  return ApiResponse.success(data);
});
```

**Estimated Effort**: 6-8 hours (new middleware package + updates to routes)  
**Refactoring Impact**: Medium - updates all route handlers  
**Testing**: Unit tests for each error type, integration tests for error responses  

---

#### 4. Missing API Response Wrapper
**Severity**: HIGH  
**Current State**: Inconsistent response formats across endpoints

**Observations**:
- Some return `{ data: ... }`
- Some return `{ user, profile, ... }`
- Some return `{ error: ... }` on error
- No standard format for paginated responses

**Problem**:
- Client cannot use consistent error handling
- Pagination format undefined for future endpoints
- No standard for metadata (timestamps, counts, etc)

**Risk if Unchanged**:
- Each new endpoint requires documentation for response format
- Client developers must handle different response structures
- Cannot build generic API error handler on frontend

**Solution**: Create standardized response format
```typescript
// @iriskey/shared/src/response.ts
export class ApiResponse {
  static success(data: unknown, meta?: unknown) {
    return NextResponse.json({
      success: true,
      data,
      meta
    });
  }

  static paginated(items: unknown[], page: number, total: number) {
    return NextResponse.json({
      success: true,
      data: items,
      meta: { page, total, hasMore: page * limit < total }
    });
  }
}

// Usage
return ApiResponse.success({ user, profile });
```

**Estimated Effort**: 4-6 hours (add to shared package, update routes)  
**Refactoring Impact**: Medium  
**Testing**: Verify format in all endpoint tests  

---

### 🟡 MEDIUM PRIORITY (Fix by Milestone 4)

#### 5. Duplicated Validation Schemas
**Severity**: MEDIUM  
**Current State**: Zod schemas defined in each route file

**Locations**:
```
apps/lao-web/src/app/api/auth/register/route.ts
apps/lao-web/src/app/api/profile/route.ts
apps/lao-web/src/app/api/settings/route.ts
(future endpoints will repeat)
```

**Problem**:
- User updates schema defined in register, profile, settings
- Each has slightly different validation rules
- If validation rules should change, must update multiple places
- No reusable validation library for products

**Risk if Unchanged**:
- Inconsistent validation rules across endpoints
- Hard to maintain consistent validation
- Validation logic not testable in isolation

**Solution**: Create validation package
```typescript
// @iriskey/shared/src/validators.ts
export const profileUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatar: z.string().url().optional(),
});

// Usage
const validation = profileUpdateSchema.safeParse(body);
```

**Estimated Effort**: 3-4 hours  
**Refactoring Impact**: Low  

---

#### 6. Missing Audit Logging Service
**Severity**: MEDIUM  
**Current State**: Audit logs created manually in each route

**Problem**:
- Duplicated `prisma.auditLog.create()` calls
- Easy to forget to log an action
- No consistent audit log format
- Hard to add fields (IP address, user agent, etc)

**Risk if Unchanged**:
- Missed audit logs = compliance violations
- Cannot track all user actions
- Hard to add observability features

**Solution**: Create @iriskey/audit package
```typescript
// @iriskey/audit/src/service.ts
export class AuditService {
  async logAction(userId: string, productId: string, action: string, ...) {
    return prisma.auditLog.create({
      data: { userId, productId, action, ... }
    });
  }
}

// Usage
await auditService.logAction('user123', 'lao', 'profile_updated', {
  resource: 'profile',
  details: { fields: ['name', 'bio'] }
});
```

**Estimated Effort**: 5-6 hours (new package + audit log type definitions)  
**Refactoring Impact**: Medium (replace manual logging in routes)  

---

#### 7. Missing Credits Service
**Severity**: MEDIUM  
**Current State**: Credits returned in dashboard but no deduction logic

**Problem**:
- No service to deduct credits when users interact with AI
- No way to check credit balance before operation
- No monthly reset logic implemented
- Credits tightly coupled to User in database

**Risk if Unchanged**:
- Cannot implement AI Router integration (Milestone 5) without refactor
- Users won't be charged for AI usage
- Cannot track monthly usage limits

**Solution**: Create @iriskey/credits package
```typescript
// @iriskey/credits/src/service.ts
export class CreditsService {
  async hasCredits(userId: string, cost: number): Promise<boolean> {
    const balance = await getBalance(userId);
    return balance >= cost;
  }

  async deductCredits(userId: string, cost: number) {
    // Deduct from balance OR monthly reset counter
  }

  async resetMonthly() {
    // Batch reset all users' monthly counters
  }
}
```

**Estimated Effort**: 8-10 hours (new package + monthly reset job)  
**Refactoring Impact**: Medium  

---

### 🟠 LOW PRIORITY (Fix by Milestone 5)

#### 8. Missing @iriskey/config Package
**Severity**: LOW  
**Current State**: Configuration scattered (some in .env, some hardcoded)

**Solution**: Centralized configuration management  
**Estimated Effort**: 4-6 hours  

---

#### 9. Missing @iriskey/notifications Package
**Severity**: LOW  
**Current State**: No email sending for onboarding  

**Needed for**: Milestone 3 (onboarding emails)  
**Estimated Effort**: 8-12 hours  

---

#### 10. Missing @iriskey/analytics Package
**Severity**: LOW  
**Current State**: Events not tracked  

**Needed for**: Milestone 4 (metrics and dashboards)  
**Estimated Effort**: 10-15 hours  

---

#### 11. Missing pnpm-workspace.yaml
**Severity**: LOW  
**Current State**: Using package.json workspaces (not pnpm standard)

**Impact**: Minor warning on pnpm install  
**Solution**: Add pnpm-workspace.yaml with:
```yaml
packages:
  - 'apps/*'
  - 'packages/iriskey/*'
  - 'packages/lao/*'
```

**Estimated Effort**: 30 minutes  

---

## Scalability Concerns

### Database Connection Management
**Risk Level**: HIGH (at 50k+ users)

**Current**: 8 separate Prisma instances
- Each instance: 10 connection pool = 80 connections per app server
- 3 app servers = 240 connections
- PostgreSQL default limit: 100 total
- **Result**: Connection exhaustion at ~5k concurrent users

**Mitigation**: 
1. Use singleton pattern (HIGH priority)
2. Add connection pooling (PgBouncer) at scale
3. Monitor connection usage

**Timeline**: Fix before Milestone 4 (50k users expected)

---

### Request Validation & Rate Limiting
**Risk Level**: MEDIUM (at 10k+ users)

**Current**: No rate limiting or request validation middleware
- No protection against brute force login attempts
- No protection against spam API calls
- No request size limits

**Mitigation**:
1. Add rate limiting middleware (Milestone 3)
2. Add request size limits
3. Add request validation middleware

**Timeline**: Fix before user launch

---

### Error Logging & Monitoring
**Risk Level**: MEDIUM (at 5k+ users)

**Current**: Using console.error for all errors
- No structured logging
- No error tracking service
- No alerting

**Mitigation**:
1. Implement structured logging (Milestone 3)
2. Add error tracking (Sentry or similar)
3. Create dashboards for error rates

**Timeline**: Fix before Milestone 4

---

## Refactoring Roadmap

### Phase 1: Milestone 3 (High Priority Fixes)
```
Timeline: 2-3 weeks
Effort: ~20-30 hours

1. Create singleton Prisma client (2-4h)
2. Create error handling middleware (6-8h)
3. Create API response wrapper (4-6h)
4. Create @iriskey/config package (4-6h)
5. Update all routes to use new patterns (4-6h)
6. Add pnpm-workspace.yaml (0.5h)
```

### Phase 2: Milestone 4 (Medium Priority)
```
Timeline: 1-2 weeks
Effort: ~15-20 hours

1. Create @iriskey/audit package (5-6h)
2. Create @iriskey/credits package (8-10h)
3. Implement monthly reset job (4-5h)
```

### Phase 3: Milestone 5 (Low Priority)
```
Timeline: 1-2 weeks
Effort: ~25-30 hours

1. Create @iriskey/notifications package (8-12h)
2. Create @iriskey/analytics package (10-15h)
3. Integrate with AI Router (5-8h)
```

---

## Impact Analysis

### If Debt is NOT Fixed Before Milestone 3

**Development Speed**:
- Every new endpoint requires boilerplate (error handling, validation, audit logging)
- 30% slower development compared to refactored version
- Developers frustrated by repeated code

**Code Quality**:
- Inconsistent patterns across codebase
- Higher bug density (copy-paste errors)
- Harder to review and test

**Operational**:
- At 10k users: Connection pool issues surface
- At 5k users: Monitoring blind spots
- Hard to debug production issues

**Estimated Cost**: 
- 20-30 hours of developer time wasted on repeated code (Milestones 3-6)
- 1-2 weeks delay in feature delivery

---

### If Debt is Fixed Before Milestone 3

**Development Speed**:
- Milestone 3+ endpoints: 50% faster development
- Developers write business logic, not boilerplate
- New team members ramp up faster

**Code Quality**:
- Consistent patterns across codebase
- Lower bug density
- Easier to review and test

**Operational**:
- Handles 100k+ concurrent users without connection issues
- Built-in error tracking and monitoring
- Scalable from day one

**Estimated Savings**:
- 20-30 hours of developer time saved (Milestones 3-6)
- 1-2 weeks faster feature delivery
- Fewer production incidents

---

## Risk Matrix

| Issue | Severity | Impact at Scale | Fixable in M3 | Recommendation |
|-------|----------|-----------------|---------------|-----------------|
| Multiple Prisma instances | HIGH | Connection exhaustion at 50k | ✅ Yes (2-4h) | **Fix in M3** |
| Hardcoded product IDs | HIGH | Blocks multi-product | ✅ Yes (4-6h) | **Fix in M3** |
| Duplicated error handling | HIGH | Inconsistent APIs | ✅ Yes (6-8h) | **Fix in M3** |
| No response wrapper | HIGH | Client fragmentation | ✅ Yes (4-6h) | **Fix in M3** |
| Duplicated validation | MEDIUM | Hard to maintain | ✅ Yes (3-4h) | Fix in M3/4 |
| Missing audit service | MEDIUM | Compliance risk | ✅ Yes (5-6h) | Fix in M3/4 |
| Missing credits service | MEDIUM | Blocks M5 features | ✅ Yes (8-10h) | Fix in M4 |
| No @iriskey/config | MEDIUM | Config scattered | ✅ Yes (4-6h) | Fix in M3/4 |
| No monitoring | MEDIUM | Blind at scale | ✅ Yes (varies) | Fix in M3 |
| pnpm-workspace.yaml | LOW | Minor warning | ✅ Yes (0.5h) | Fix in M3 |

---

## Recommendation

### ✅ Ready to Proceed to Milestone 3 WITH Conditions

**Prerequisites for Milestone 3**:
1. Fix HIGH priority items (Prisma singleton, hardcoded IDs, error handling, response wrapper)
2. Create @iriskey/config package
3. Update all existing routes to use new patterns

**Timeline**: These fixes can be completed in 1-2 weeks before starting feature work on Milestone 3

**Effort Estimate**: 20-25 hours of refactoring

**Benefit**: 
- Enables 50% faster development in Milestones 3+
- Ensures scalability without bottlenecks
- Improves code consistency and maintainability

### Do NOT Proceed Without These Fixes

Proceeding without fixes will result in:
- Milestone 3+ taking 20-30% longer than estimated
- Harder to add new endpoints (more boilerplate)
- Connection pool issues at scale
- Technical debt compounding with each milestone

---

## Summary

The platform foundation is solid (zero product-specific code in packages). Current debt is technical (patterns and configuration), not architectural. All identified issues can be fixed within Milestone 3 timeline.

**Verdict**: **READY for Milestone 3** after addressing HIGH priority refactoring (1-2 weeks work).
