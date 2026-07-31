# LAO Architecture - Milestone 1: Authentication

## Overview

LAO (AI Learning Operating System) is a production-grade SaaS platform designed to scale from 1 to 1 million users. Milestone 1 establishes the foundation with a robust authentication system, database layer, and extensible architecture for future AI provider integration.

## Design Principles

1. **Production First** - Every line of code is production-ready
2. **Scalability** - Architecture supports millions of concurrent users
3. **Security** - OWASP compliant, encrypted, audited
4. **Simplicity** - Minimal complexity, maximum clarity
5. **Extensibility** - Easy to add providers and features
6. **Observability** - Complete audit trails for all operations

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Client Layer (Web Browser)                                      │
│ Next.js 14 React + TypeScript + TailwindCSS                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│ API Layer (Next.js App Router)                                  │
│ - /api/auth/[...nextauth] - NextAuth handlers                   │
│ - /api/auth/register - User registration                        │
│ - /api/auth/verify-email - Email verification                   │
│ - /api/auth/forgot-password - Password reset                    │
│ - Middleware - Protected routes, rate limiting                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│ Business Logic Layer (@lao/auth, @lao/shared)                   │
│ - Credentials provider (username/password)                      │
│ - OAuth providers (Google, GitHub)                              │
│ - Password hashing (bcrypt)                                     │
│ - Verification tokens                                           │
│ - Session management (JWT)                                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│ Data Layer (Prisma ORM)                                         │
│ - Abstraction over PostgreSQL                                   │
│ - Type-safe queries                                             │
│ - Migrations and schema versioning                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│ Database (PostgreSQL)                                           │
│ - Users, Profiles, Sessions                                     │
│ - Roles, Permissions, AuditLogs                                 │
│ - Credits, Settings, FeatureFlags                               │
└─────────────────────────────────────────────────────────────────┘
```

## Authentication Flow

### Registration Flow

```
User → Browser
  │
  ├─ Fill registration form
  │   (name, email, password)
  │
  └─ POST /api/auth/register
       │
       ├─ Validate input (Zod)
       ├─ Check email not taken
       ├─ Hash password (bcrypt)
       ├─ Create user + profile + credits + settings
       ├─ Generate verification token
       ├─ Log audit event
       │
       └─ Response: "Check email for verification"
            │
            └─ User clicks link in email
                 │
                 └─ GET /auth/verify-email?email=...&token=...
                      │
                      ├─ POST /api/auth/verify-email
                      ├─ Verify token + expiry
                      ├─ Update user.emailVerified
                      ├─ Delete token
                      ├─ Log audit event
                      │
                      └─ Redirect to login
```

### Login Flow

```
User → Browser
  │
  ├─ Email/password credentials OR
  ├─ Click "Sign in with Google" OR
  ├─ Click "Sign in with GitHub"
  │
  └─ POST /api/auth/[...nextauth]
       │
       ├─ [Email/Password Provider]
       │   ├─ Find user by email
       │   ├─ Verify password hash
       │   └─ Return user object
       │
       ├─ [Google Provider]
       │   ├─ Redirect to Google
       │   ├─ Google returns code
       │   ├─ Exchange code for token
       │   ├─ Get user info from Google
       │   ├─ Create/update account link
       │   └─ Return user object
       │
       └─ [GitHub Provider]
           ├─ Redirect to GitHub
           ├─ GitHub returns code
           ├─ Exchange code for token
           ├─ Get user info from GitHub
           ├─ Create/update account link
           └─ Return user object
       │
       ├─ Create JWT session token
       ├─ Set secure HTTP-only cookie
       ├─ Log signin audit event
       │
       └─ Redirect to dashboard
            │
            └─ Middleware checks token
                 ├─ Token valid? → Allow access
                 └─ Token invalid? → Redirect to login
```

### Password Reset Flow

```
User → Browser
  │
  ├─ Click "Forgot password"
  │
  └─ POST /api/auth/forgot-password
       │
       ├─ Find user by email
       ├─ Generate reset token
       ├─ Save token with 1-hour expiry
       ├─ Log audit event
       │
       └─ Response: "Check email for reset link"
            │
            └─ User clicks link in email
                 │
                 └─ GET /auth/reset-password?token=...
                      │
                      └─ POST /api/auth/reset-password
                           │
                           ├─ Verify token + expiry
                           ├─ Validate new password
                           ├─ Hash password
                           ├─ Update user.password
                           ├─ Delete token
                           ├─ Log audit event
                           │
                           └─ Redirect to login
```

## Authentication Providers

### 1. Email/Password (Credentials Provider)

**Flow**: User enters email and password → bcrypt verification

**Security**:
- Passwords hashed with bcrypt (12 rounds)
- Constant-time comparison to prevent timing attacks
- No plaintext passwords in database or logs

**Configuration**:
```typescript
Credentials({
  id: 'credentials',
  credentials: {
    email: { label: 'Email', type: 'email' },
    password: { label: 'Password', type: 'password' },
  },
  async authorize(credentials) {
    // Verify email and password
  }
})
```

### 2. Google OAuth

**Flow**: User clicks "Sign in with Google" → OAuth redirect → Token exchange

**Security**:
- OAuth 2.0 standard flow
- PKCE for additional protection
- Client ID/Secret stored in environment
- AllowDangerousEmailAccountLinking enabled for existing email users

**Configuration**:
```typescript
Google({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  allowDangerousEmailAccountLinking: true,
})
```

### 3. GitHub OAuth

**Flow**: Similar to Google OAuth

**Configuration**:
```typescript
GitHub({
  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  allowDangerousEmailAccountLinking: true,
})
```

## Session Management

**Strategy**: JWT-based sessions (not database sessions)

**Reasoning**:
- Stateless: No database lookup on every request
- Scalable: Works across multiple instances/servers
- Secure: Signed and encrypted

**Configuration**:
- Session maxAge: 30 days
- JWT maxAge: 30 days
- Update age: 1 day (refresh when within 1 day of expiry)
- Secure cookies: HTTP-only, SameSite=Lax

## Middleware Protection

Middleware runs on every request to check authentication:

```typescript
// Protected routes require authentication
const protectedRoutes = ['/dashboard', '/settings', '/courses']

// Public routes redirect to dashboard if authenticated
const publicRoutes = ['/auth/login', '/auth/register']

// Unprotected routes: /api/*, /, /auth/error, etc
```

## Database Schema (Relevant to Auth)

### Users Table
```sql
- id (string, PK)
- email (string, UNIQUE)
- emailVerified (datetime, nullable)
- name (string, nullable)
- image (string, nullable)
- password (string, nullable) -- only for credentials provider
- createdAt, updatedAt
```

### Accounts Table
```sql
- id, userId (FK), type, provider, providerAccountId
- OAuth provider links
- Allows multiple providers per user
```

### Sessions Table
```sql
- id, sessionToken (UNIQUE), userId (FK), expires
- Legacy session storage (can be optional with JWT)
```

### VerificationTokens Table
```sql
- identifier (email), token, expires, type
- Tracks email verification and password reset tokens
```

### AuditLogs Table
```sql
- id, userId (FK), action, resource, details, ipAddress, userAgent
- Immutable log of all authentication events
```

### Credits Table
```sql
- userId (FK, UNIQUE), balance, spent, monthlyReset
- Tracks user's AI usage credits
```

## Error Handling

All authentication errors are logged to AuditLogs for compliance and debugging:

- Invalid credentials attempt
- Email already registered
- Email verification failure
- Token expiry
- OAuth errors
- Database errors

## Rate Limiting

Implemented at middleware level:

- Register endpoint: 5 requests per hour per IP
- Login endpoint: 10 failed attempts per hour per IP
- Password reset: 3 requests per hour per email
- Email verification: 5 requests per hour per email

## Security Measures

### Password Security
- Minimum 8 characters (enforced by schema validation)
- Hashed with bcrypt (12 rounds, ~100ms per hash)
- Never logged or stored in plaintext
- Constant-time comparison

### Email Verification
- Token: 32-byte random hex (cryptographically secure)
- Expiry: 24 hours
- Deleted after use
- Case-insensitive email matching

### Password Reset
- Token: 32-byte random hex
- Expiry: 1 hour (shorter than email verification)
- Deleted after use
- Requires current session invalidation

### Session Tokens
- JWT signed with NEXTAUTH_SECRET
- Encrypted with algorithm HS512
- No sensitive data in token (just user ID)
- Verified on every protected route

### CSRF Protection
- NextAuth built-in CSRF tokens
- SameSite=Lax cookies
- State parameter in OAuth flows

### HTTP Headers
- Content-Security-Policy
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security (in production)

## Future Extensions

### IrisKey Biometric Integration

The authentication system is designed to support IrisKey as another provider:

```typescript
// Future: IrisKey provider
IrisKey({
  clientId: process.env.IRISKEY_CLIENT_ID,
  clientSecret: process.env.IRISKEY_CLIENT_SECRET,
  // Implements same interface as Google/GitHub
})
```

**Design allows**:
- Multiple authentication methods per user
- Seamless provider switching
- Backward compatibility with existing users

### Additional Providers

Architecture supports adding:
- Apple Sign In
- Microsoft/Azure AD
- LDAP/Active Directory (enterprise)
- Passkeys/WebAuthn
- TOTP 2FA

## Deployment Considerations

### Environment Variables (Required)
```
DATABASE_URL           # PostgreSQL connection
NEXTAUTH_SECRET        # JWT signing secret (min 32 chars)
NEXTAUTH_URL          # App URL (for OAuth callbacks)
GOOGLE_CLIENT_ID      # (if using Google OAuth)
GOOGLE_CLIENT_SECRET  # (if using Google OAuth)
GITHUB_CLIENT_ID      # (if using GitHub OAuth)
GITHUB_CLIENT_SECRET  # (if using GitHub OAuth)
```

### Database Migrations
```bash
pnpm db:migrate
```

Runs all pending migrations using Prisma.

### Secrets Management
- Never commit .env files
- Use environment-specific configs
- Rotate NEXTAUTH_SECRET on security incidents
- Store OAuth credentials in secure vault (GitHub Secrets, etc)

## Monitoring & Observability

### Audit Logging
Every authentication event is logged:
- User registration
- Email verification
- Sign in attempts
- Sign out
- Password reset
- OAuth linking

```sql
SELECT * FROM AuditLog 
WHERE action IN ('user_signed_in', 'user_registered', 'email_verified')
ORDER BY createdAt DESC
```

### Metrics to Track
- Registration rate
- Login success/failure rate
- OAuth provider adoption
- Average session duration
- Password reset frequency
- Failed verification attempts

## Testing

Unit tests for:
- Password hashing/verification
- Token generation/validation
- Email validation
- OAuth flow simulation
- Middleware route protection

Integration tests for:
- Full registration flow
- Full login flow
- OAuth callback handling
- Session persistence
- Concurrent session handling

## Performance

### Optimization Techniques
- Database connection pooling (built into Prisma)
- JWT-based sessions (no DB lookup)
- Secure cookies (HTTP-only)
- Rate limiting to prevent abuse
- Early validation (Zod before DB)

### Typical Response Times
- Login: ~100-200ms (bcrypt hashing)
- OAuth callback: ~500-1000ms (network dependent)
- Session validation: ~10ms (just JWT verification)

## Next Steps (Milestone 2+)

After authentication is production-ready:

1. **Dashboard** - User profile, settings, credits display
2. **Onboarding** - Learning goals, skill assessment
3. **AI Router** - Provider selection and routing
4. **Courses** - Learning content delivery
5. **Missions** - Project-based learning

Each milestone builds on the authentication foundation established here.
