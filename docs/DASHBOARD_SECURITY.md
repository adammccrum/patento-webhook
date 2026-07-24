# Dashboard Security

**Version:** 1.0  
**Status:** Phase 3 (Development) / Phase 4 (Production)  
**Purpose:** Security model and threat mitigation for the Operation Centre dashboard

---

## Overview

The Operation Centre dashboard provides real-time observability and control over the multi-agent orchestration system. This document outlines the security model for Phase 3 (development/testing) and the production hardening required for Phase 4+.

---

## Phase 3 Security Model (Development)

### Current State (Intentional Limitations)

Phase 3 is designed for **development and testing only** with intentionally relaxed security:

**What is mocked:**
- No authentication or authorization checks
- No encryption (WebSocket, HTTP)
- All clients see all data
- No rate limiting
- No audit trail persistence
- No credentials/secrets management
- Mock agent execution (simulated, not real)
- In-memory state only (cleared on restart)

**Why this is acceptable:**
- Isolated development environment
- No production data or real system access
- Team members are trusted developers
- Focus on feature validation over security
- Placeholder for production hardening

### Threats Mitigated in Phase 3

1. **Information Disclosure**
   - Mitigation: Verify no sensitive data (API keys, passwords, tokens) is logged or transmitted in events
   - Implementation: Event audit in tests confirms no 'password', 'secret', 'api_key', 'token' fields in dashboard state
   - Limitation: All dashboards see same data; no privacy separation

2. **Accidental State Mutation**
   - Mitigation: API routes only record control actions (pause/resume/cancel) as events; never mutate state directly
   - Implementation: Control actions recorded in audit trail with user_id and timestamp
   - Design: Safe user controls that coordinate through Alpha orchestrator

3. **System Overload**
   - Mitigation: In-memory event history limited to 1000 events; old events automatically discarded (~5 hour window)
   - Implementation: EventAggregator maintains fixed-size eventHistory array
   - Monitoring: getConnectedClientCount() and getAllClientsInfo() available for inspection

---

## Phase 4 Production Security

### Required Hardening

#### 1. Authentication

- **Implement:** JWT token-based authentication with RS256 signing
- **Scope:** All HTTP endpoints and WebSocket connections require Bearer token
- **Integration:** Verify tokens with IrisKey biometric verification system
- **Implementation:**
  - Auth middleware validates token signature and expiration
  - WebSocket connections require token in query string or header
  - Token refresh mechanism with sliding expiration (15min access, 7day refresh)
  - Revocation list for invalidated tokens

#### 2. Authorization (RBAC)

- **Roles:**
  - `admin`: Full access to all dashboard features and control actions
  - `operator`: View all data, perform pause/resume/cancel
  - `auditor`: View only (no control actions)
  - `agent`: Read-only access to own task status

- **Scope Filtering:**
  - Users see only events/data relevant to their organization or team
  - Agents cannot see other agents' internal state
  - Audit logs filtered by user role

- **Implementation:**
  - Express middleware checks user role against endpoint
  - EventAggregator filters events by subscription role
  - WebSocket messages tagged with user/role context

#### 3. Encryption

- **TLS/SSL:**
  - All HTTP connections use HTTPS with TLS 1.3+
  - Certificate pinning for critical endpoints
  - HSTS header with 1 year max-age

- **WebSocket Secure (WSS):**
  - All WebSocket connections use WSS (ws:// → wss://)
  - Same TLS configuration as HTTP
  - Certificate validation in client code

- **At Rest:**
  - Event history stored in database with field-level encryption for sensitive fields
  - Authorization requests encrypted with per-request keys
  - Audit trail stored with tamper-evident hashing

#### 4. Input Validation

- **HTTP Endpoints:**
  - All request parameters validated with Joi schemas
  - Maximum payload size limits (1MB)
  - Content-Type validation (application/json only)

- **WebSocket Messages:**
  - Message schema validation before processing
  - Filter parameter type checking (string, array)
  - Maximum message size limit (64KB)

#### 5. Rate Limiting

- **API Endpoints:**
  - Per-user rate limit: 100 requests/minute
  - Per-IP rate limit: 1000 requests/minute (burst allowance)
  - Graduated backoff for repeated violations

- **WebSocket:**
  - Per-client message rate limit: 100 messages/minute
  - Connection limit: max 1000 simultaneous connections globally
  - Per-user limit: max 10 connections per user

#### 6. Audit Logging

- **What to Log:**
  - All WebSocket connections (connect/disconnect with timestamp, user, IP)
  - All control actions (pause/resume/cancel) with initiator
  - All authorization requests and decisions
  - All failed authentication/authorization attempts
  - Dashboard state snapshot requests (periodic sampling)

- **Storage:**
  - Write to immutable database table with automatic archival
  - Tamper detection via hash chain (each row hashes previous row)
  - 7-year retention for compliance
  - Encrypted transport to audit storage (separate database)

- **Access:**
  - Auditor role only (read-only)
  - Queries logged and rate-limited
  - Export functionality with signature verification

#### 7. CSP (Content Security Policy)

For dashboard HTML (public/index.html):

```
Content-Security-Policy: 
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  font-src 'self';
  connect-src 'self' wss:;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self'
```

#### 8. Session Management

- **Token Claims:**
  - `sub`: user ID
  - `role`: user role
  - `org`: organization ID
  - `exp`: expiration timestamp
  - `iat`: issued at timestamp
  - `nonce`: one-time use nonce (prevent replay)

- **Refresh Token:**
  - Stored in HTTP-only, Secure cookie (not accessible to JavaScript)
  - Single-use tokens (invalidated after refresh)
  - Rotation on each use (new refresh token on access token refresh)

#### 9. Error Handling

- **Security Principles:**
  - No stack traces in client responses
  - Generic error messages (don't reveal system details)
  - Log full errors server-side only
  - HTTP 400 for all client errors (don't distinguish 401 vs 403)

- **Exception:**
  - 401 for missing/invalid token (required for auth retry)
  - 429 for rate limit (with Retry-After header)

#### 10. Secrets Management

- **Credentials:**
  - Store all secrets in encrypted vault (HashiCorp Vault or AWS Secrets Manager)
  - Never hardcode credentials in code or configuration
  - Rotate keys quarterly

- **Database Credentials:**
  - Use temporary credentials via IAM roles (AWS)
  - 1-hour credential expiration
  - Separate read-only credentials for audit logging

- **API Keys:**
  - Rotate monthly
  - Revoke compromised keys immediately
  - Restrict to specific operations (least privilege)

---

## Threat Model & Mitigation

### Threats

1. **Unauthorized Access to Dashboard**
   - Threat: Attacker gains access to real-time system state
   - Mitigation (Phase 4): Require JWT token + biometric verification
   - Residual Risk: Token theft (mitigated by short expiration, HTTPS, HTTP-only cookies)

2. **Lateral Movement via WebSocket**
   - Threat: Attacker connects via WebSocket and subscribes to sensitive events
   - Mitigation: Role-based filtering, WebSocket per-client rate limit
   - Residual Risk: Compromised token allows full access (mitigated by revocation list)

3. **Privilege Escalation**
   - Threat: Operator modifies control action to execute arbitrary behavior
   - Mitigation: All control actions recorded as immutable audit events; state never mutated directly
   - Residual Risk: Stolen admin token (mitigated by biometric verification + hardware key requirement)

4. **Denial of Service (API)**
   - Threat: Attacker floods API with requests, crashes dashboard
   - Mitigation: Rate limiting, connection limits, gradual backoff
   - Residual Risk: Distributed attack (mitigated by WAF/load balancer)

5. **Denial of Service (WebSocket)**
   - Threat: Attacker opens many WebSocket connections or sends large payloads
   - Mitigation: Per-client connection limit, message size limit, message rate limit
   - Residual Risk: Distributed attack (mitigated by infrastructure limits)

6. **Data Interception**
   - Threat: Attacker sniffs network traffic, observes system state
   - Mitigation: HTTPS + TLS 1.3, WSS (WebSocket Secure)
   - Residual Risk: Compromised certificate authority (mitigated by certificate pinning)

7. **Audit Trail Tampering**
   - Threat: Attacker modifies audit logs to hide malicious activity
   - Mitigation: Write-only database, tamper-evident hashing, separate audit database
   - Residual Risk: Attacker with database admin access (mitigated by database-level encryption)

---

## OWASP Top 10 Alignment

| OWASP Threat | Phase 3 | Phase 4+ | Notes |
|---|---|---|---|
| A01:2021 - Broken Access Control | ❌ None | ✅ JWT + RBAC | Phase 3 mocked; Phase 4 required |
| A02:2021 - Cryptographic Failures | ❌ None | ✅ TLS 1.3, field encryption | Phase 3 unencrypted (OK for dev) |
| A03:2021 - Injection | ✅ Partial | ✅ Full | Input validation via Joi; no SQL (uses in-memory) |
| A04:2021 - Insecure Design | ⚠️ Limited | ✅ Threat-modeled | Phase 3 has safe defaults; Phase 4 hardened |
| A05:2021 - Security Misconfiguration | ⚠️ Limited | ✅ Full | Phase 3 allows all configs; Phase 4 locked-down |
| A06:2021 - Vulnerable Components | ✅ Partial | ✅ Full | npm audit shows 4 vulnerabilities; schedule resolution |
| A07:2021 - Authentication Failures | ❌ None | ✅ JWT + MFA | Phase 3 no auth; Phase 4 required |
| A08:2021 - Software/Data Integrity Failures | ⚠️ Limited | ✅ Full | No supply chain checks yet; Phase 4 add SBOM |
| A09:2021 - Logging & Monitoring Failures | ✅ Partial | ✅ Full | Audit events recorded; Phase 4 add SIEM integration |
| A10:2021 - SSRF | ✅ N/A | ✅ N/A | No outbound HTTP from dashboard |

---

## Security Checklist for Phase 4 Implementation

- [ ] Authentication: Implement JWT token validation middleware
- [ ] Authorization: Implement role-based access control (RBAC)
- [ ] Encryption: Enable HTTPS and WSS for all connections
- [ ] Input Validation: Add Joi schema validation to all WebSocket message handlers
- [ ] Rate Limiting: Add express-rate-limit to API, implement per-client WebSocket limits
- [ ] Audit Logging: Set up database audit table with tamper detection
- [ ] Secrets Management: Integrate with vault system (HashiCorp/AWS)
- [ ] CSP Headers: Add Content-Security-Policy to dashboard HTML
- [ ] Session Management: Implement token refresh with HTTP-only cookies
- [ ] Error Handling: Review all error responses, remove sensitive information
- [ ] Dependencies: Run `npm audit fix` and address vulnerabilities
- [ ] Testing: Add security tests for RBAC, rate limits, input validation
- [ ] Documentation: Update this file with implementation details

---

## Security Testing

### Manual Tests (Phase 4+)

1. **Authentication Bypass:**
   - Attempt to access API without token → 401 Unauthorized
   - Attempt to use expired token → 401 Unauthorized
   - Attempt to use token with invalid signature → 401 Unauthorized

2. **Authorization Bypass:**
   - As `auditor`, attempt POST to pause objective → 403 Forbidden
   - As `operator`, attempt to read audit logs → 403 Forbidden
   - Attempt to subscribe to events outside user's scope → filtered silently

3. **Input Validation:**
   - Send WebSocket subscribe with invalid JSON → error response
   - Send oversized payload (>64KB) → connection closed
   - Send SQL injection in filter (if any SQL used) → no effect

4. **Rate Limiting:**
   - Send 100+ requests/minute as same user → 429 Too Many Requests
   - Open 10+ WebSocket connections as same user → connection refused

5. **Data Integrity:**
   - Verify pause/resume/cancel recorded in audit trail with user ID
   - Verify audit trail tamper detection (hash validation)

---

## Compliance

### Standards

- **OWASP Top 10:** Aligned (see section above)
- **NIST Cybersecurity Framework:** Identify, Protect, Detect (Phase 4)
- **ISO 27001:** Applicable for production deployments
- **GDPR (if EU):** Personal data in audit logs requires retention policy

### IrisKey Integration

The Operation Centre integrates with IrisKey biometric verification:

- **Authentication:** Biometric verification required for sensitive operations (approval/denial)
- **MFA:** Combine JWT token + biometric for high-risk actions
- **Audit:** Biometric verification events logged to audit trail
- **Privacy:** Biometric data stored separately in IrisKey system (not in Operation Centre)

---

## Security Incident Response

### Procedure (Phase 4+)

1. **Detection:** SIEM alert on unusual activity (rate limit violation, auth failure spike, etc.)
2. **Containment:** Revoke compromised token, disable user account, check audit trail
3. **Investigation:** Query audit trail for actions by compromised user
4. **Notification:** Alert security team and affected users
5. **Remediation:** Reset passwords/tokens, re-enable with MFA
6. **Post-Incident:** Review logs, update threat model, patch vulnerabilities

### Contact

- **Security Team:** security@lao-academy.edu
- **Incident Report:** security-incidents@lao-academy.edu
- **Responsible Disclosure:** See SECURITY.md for responsible disclosure policy

---

## Future Enhancements (Phase 5+)

- Hardware security tokens for admin users
- Behavioral anomaly detection via machine learning
- Zero-trust architecture (verify every request)
- Decentralized audit trail via blockchain
- Real-time threat intelligence feeds
- Automated incident response orchestration

