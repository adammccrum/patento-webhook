# Authorization and Audit System Specification

**Version:** 1.0  
**Purpose:** Define identity verification, permission checking, and immutable audit trails  
**Status:** Active

---

## Overview

Every action in the system must be:
1. **Verified** - User identity confirmed via IrisKey
2. **Authorized** - User has permission for the action
3. **Audited** - Action recorded immutably
4. **Gated** - High-impact actions may require explicit approval

---

## Authorization Flow

```
User Request
    ↓
┌─────────────────────────────────────┐
│ 1. Identity Verification (IrisKey)  │  Check user is who they claim
├─────────────────────────────────────┤
│ 2. Agent Authorization              │  Check if agent can act
├─────────────────────────────────────┤
│ 3. Permission Check                 │  Check user has permission for action
├─────────────────────────────────────┤
│ 4. Policy Evaluation                │  Check constraints & policies
├─────────────────────────────────────┤
│ 5. Cost Estimation                  │  Estimate cost, check limits
├─────────────────────────────────────┤
│ 6. Explicit Approval (if needed)    │  For high-impact actions
├─────────────────────────────────────┤
│ 7. Execution                        │  Perform the action
├─────────────────────────────────────┤
│ 8. Audit Event Recording            │  Immutable log
└─────────────────────────────────────┘
    ↓
Return Result or Error
```

---

## IrisKey Integration

Sierra agent handles identity verification via IrisKey biometric system:

```javascript
// src/authorization/iriskey-client.js

class IrisKeyClient {
  constructor(config) {
    this.apiUrl = config.iriskey_api_url;
    this.apiKey = config.iriskey_api_key;
  }

  async verifyIdentity(userId, biometricData) {
    // Call IrisKey API to verify biometric
    const response = await axios.post(
      `${this.apiUrl}/verify`,
      {
        user_id: userId,
        biometric: biometricData
      },
      {
        headers: { Authorization: `Bearer ${this.apiKey}` }
      }
    );

    if (!response.data.verified) {
      throw new AuthorizationError(
        'IDENTITY_VERIFICATION_FAILED',
        'Biometric verification failed'
      );
    }

    return {
      user_id: userId,
      verified_at: new Date().toISOString(),
      verification_method: 'iris-biometric',
      confidence: response.data.confidence
    };
  }

  async getUserPermissions(userId) {
    // Get user's permission set from IrisKey
    const response = await axios.get(
      `${this.apiUrl}/users/${userId}/permissions`,
      {
        headers: { Authorization: `Bearer ${this.apiKey}` }
      }
    );

    return response.data.permissions || [];
  }

  async hasPermission(userId, permission) {
    const permissions = await this.getUserPermissions(userId);
    return permissions.includes(permission) || 
           permissions.includes('*'); // '*' = admin
  }
}

module.exports = IrisKeyClient;
```

---

## Permission System

Permissions are hierarchical and role-based:

```yaml
# config/permissions.yaml

roles:
  admin:
    permissions:
      - "*"  # All permissions

  operator:
    permissions:
      - "courses:create"
      - "courses:edit"
      - "courses:publish"
      - "media:generate:image"
      - "media:generate:video"
      - "voice:generate"

  viewer:
    permissions:
      - "courses:read"
      - "media:read"
      - "voice:listen"

permissions:
  courses:create:
    label: "Create courses"
    category: "content"
    high_impact: true
    requires_approval: true
    cost_estimate: true

  courses:publish:
    label: "Publish courses to LAO"
    category: "content"
    high_impact: true
    requires_approval: true
    audit_required: true

  media:generate:image:
    label: "Generate images"
    category: "media"
    high_impact: false
    requires_approval: false
    cost_estimate: true
    rate_limit: "1000/hour"

  voice:generate:
    label: "Generate voice narration"
    category: "audio"
    high_impact: false
    requires_approval: false
    cost_estimate: true
```

---

## Permission Checker

```javascript
// src/authorization/permission-checker.js

class PermissionChecker {
  constructor(irisKeyClient, policiesConfig) {
    this.irisKey = irisKeyClient;
    this.policies = policiesConfig;
  }

  async checkPermission(userId, action, context = {}) {
    // 1. Verify identity
    if (!context.verified_identity) {
      throw new AuthorizationError(
        'IDENTITY_NOT_VERIFIED',
        'User identity must be verified first'
      );
    }

    // 2. Check if user has permission
    const hasPermission = await this.irisKey.hasPermission(userId, action);
    if (!hasPermission) {
      await this.logDeniedAction(userId, action, 'PERMISSION_DENIED');
      throw new AuthorizationError(
        'PERMISSION_DENIED',
        `User ${userId} does not have permission for ${action}`
      );
    }

    // 3. Check policy constraints
    const policy = this.policies[action];
    if (policy) {
      this.checkPolicyConstraints(policy, context);
    }

    // 4. Check rate limits
    if (policy?.rate_limit) {
      await this.checkRateLimit(userId, action, policy.rate_limit);
    }

    // 5. Cost estimation
    if (policy?.cost_estimate && context.estimate_cost) {
      const cost = await this.estimateCost(action, context);
      if (cost > context.max_cost) {
        throw new AuthorizationError(
          'COST_EXCEEDED',
          `Estimated cost $${cost} exceeds limit $${context.max_cost}`
        );
      }
      context.estimated_cost = cost;
    }

    return {
      authorized: true,
      user_id: userId,
      action: action,
      policy: policy,
      cost: context.estimated_cost || 0
    };
  }

  checkPolicyConstraints(policy, context) {
    // Check if action is allowed in current context
    // E.g., time-based restrictions, rate limits, resource constraints

    if (policy.time_windows) {
      const now = new Date();
      const allowed = policy.time_windows.some(window => {
        const [start, end] = window.split('-');
        // Check if current time is in window
      });
      if (!allowed) {
        throw new AuthorizationError(
          'OUTSIDE_TIME_WINDOW',
          `Action not allowed at this time`
        );
      }
    }

    if (policy.max_concurrent && context.current_concurrent >= policy.max_concurrent) {
      throw new AuthorizationError(
        'CONCURRENT_LIMIT_EXCEEDED',
        `Maximum concurrent operations (${policy.max_concurrent}) reached`
      );
    }
  }

  async checkRateLimit(userId, action, limit) {
    // Parse limit: "1000/hour", "10/minute", etc.
    const [count, period] = limit.split('/');
    const periodMs = this.parsePeriod(period);

    // Get recent action count for user
    const recentCount = await this.getRecentActionCount(userId, action, periodMs);

    if (recentCount >= parseInt(count)) {
      throw new AuthorizationError(
        'RATE_LIMIT_EXCEEDED',
        `Rate limit exceeded: ${count} per ${period}`
      );
    }
  }

  async estimateCost(action, context) {
    // Estimate cost based on action and parameters
    // This will vary by provider

    if (action.includes('media:generate:image')) {
      return 0.03; // $0.03 per image (Stability AI estimate)
    }

    if (action.includes('voice:generate')) {
      return 0; // Free (local Voicebox)
    }

    return 0; // Default free
  }

  async logDeniedAction(userId, action, reason) {
    await auditLog({
      timestamp: new Date().toISOString(),
      event_type: 'authorization_denied',
      user_id: userId,
      action: action,
      reason: reason
    });
  }
}

module.exports = PermissionChecker;
```

---

## Audit System

Immutable recording of all system actions:

```javascript
// src/audit/audit-logger.js

class AuditLogger {
  constructor(storage) {
    this.storage = storage; // FileStorage, DatabaseStorage, etc.
  }

  async logAction(event) {
    // Ensure all required fields present
    const auditEvent = {
      id: uuid(),
      timestamp: new Date().toISOString(),
      event_type: event.event_type,
      user_id: event.user_id,
      agent: event.agent,
      action: event.action,
      resource_ids: event.resource_ids || [],
      status: event.status,
      result_details: event.result_details,
      cost: event.cost || 0,
      provider_used: event.provider_used,
      ip_address: event.ip_address,
      request_id: event.request_id,
      additional_data: event.additional_data
    };

    // Validate
    this.validateAuditEvent(auditEvent);

    // Store immutably
    await this.storage.append(auditEvent);

    // Also send to external logging if configured
    if (this.externalLogger) {
      await this.externalLogger.log(auditEvent);
    }

    return auditEvent;
  }

  validateAuditEvent(event) {
    const required = [
      'id',
      'timestamp',
      'event_type',
      'user_id',
      'action',
      'status'
    ];

    for (const field of required) {
      if (!event[field]) {
        throw new Error(`Missing required audit field: ${field}`);
      }
    }
  }

  async getAuditTrail(filters = {}) {
    // Retrieve audit events matching filters
    return this.storage.query(filters);
  }

  async getAuditTrailForUser(userId, limit = 100) {
    return this.getAuditTrail({ user_id: userId, limit });
  }

  async getAuditTrailForAction(action, limit = 100) {
    return this.getAuditTrail({ action, limit });
  }

  async validateIntegrity() {
    // Verify audit trail integrity (checksums, ordering)
    return this.storage.validateIntegrity();
  }
}

module.exports = AuditLogger;
```

---

## Audit Event Schema

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-07-24T10:30:00Z",
  "event_type": "action_executed",
  "user_id": "user@example.com",
  "agent": "Foxtrot",
  "agent_code": "FF",
  "action": "media:generate:image",
  "resource_ids": ["course-123", "lesson-456"],
  "status": "success",
  "result_details": {
    "images_generated": 5,
    "resolution": "1024x1024",
    "quality": "high"
  },
  "cost": 0.15,
  "cost_currency": "USD",
  "provider_used": "stability-ai",
  "ip_address": "192.168.1.100",
  "request_id": "req-789",
  "authorization_status": "approved",
  "approval_time_ms": 250,
  "execution_time_ms": 45000,
  "error": null,
  "additional_data": {
    "model": "stable-diffusion-xl",
    "prompt": "classroom with students...",
    "fallback_used": false
  }
}
```

---

## Storage Backends

### File-based (Development)

```javascript
// src/audit/file-storage.js

const fs = require('fs').promises;
const path = require('path');

class FileAuditStorage {
  constructor(directory) {
    this.directory = directory;
  }

  async append(event) {
    const date = new Date().toISOString().split('T')[0];
    const filename = path.join(this.directory, `audit-${date}.jsonl`);
    
    // Append to file (JSONL format)
    await fs.appendFile(
      filename,
      JSON.stringify(event) + '\n'
    );
  }

  async query(filters) {
    // Read and filter events
    // For development only - use database for production
  }

  async validateIntegrity() {
    // Verify file structure and checksums
  }
}
```

### Database-based (Production)

```javascript
// src/audit/database-storage.js

class DatabaseAuditStorage {
  constructor(db) {
    this.db = db;
  }

  async append(event) {
    // Insert into audit table
    await this.db.query(
      `INSERT INTO audit_events 
       (id, timestamp, event_type, user_id, agent, action, status, cost, provider_used, result_details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        event.id,
        event.timestamp,
        event.event_type,
        event.user_id,
        event.agent,
        event.action,
        event.status,
        event.cost,
        event.provider_used,
        JSON.stringify(event.result_details)
      ]
    );
  }

  async query(filters) {
    // Build parameterized query
    let query = 'SELECT * FROM audit_events WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.user_id) {
      query += ` AND user_id = $${paramCount++}`;
      params.push(filters.user_id);
    }

    if (filters.action) {
      query += ` AND action = $${paramCount++}`;
      params.push(filters.action);
    }

    if (filters.since) {
      query += ` AND timestamp >= $${paramCount++}`;
      params.push(filters.since);
    }

    query += ` ORDER BY timestamp DESC`;
    
    if (filters.limit) {
      query += ` LIMIT $${paramCount++}`;
      params.push(filters.limit);
    }

    return this.db.query(query, params);
  }

  async validateIntegrity() {
    // Check database integrity
  }
}
```

---

## High-Impact Actions

Actions requiring explicit approval:

```yaml
high_impact_actions:
  - action: "courses:publish"
    label: "Publish course to LAO Academy"
    requires_approval: true
    approval_timeout_minutes: 5
    audit_required: true

  - action: "media:generate:video:high"
    label: "Generate high-resolution video"
    requires_approval: true
    cost_threshold: 5.00
    approval_timeout_minutes: 10

  - action: "voice:clone"
    label: "Clone user voice"
    requires_approval: true
    audit_required: true

  - action: "data:export"
    label: "Export user data"
    requires_approval: true
    audit_required: true

  - action: "system:configuration:change"
    label: "Change system configuration"
    requires_approval: true
    approval_timeout_minutes: 15
```

For high-impact actions, system creates an approval request:

```javascript
// src/authorization/approval-gateway.js

class ApprovalGateway {
  async requestApproval(userId, action, context = {}) {
    const approvalRequest = {
      id: uuid(),
      user_id: userId,
      action: action,
      context: context,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 5 * 60000), // 5 min default
      status: 'pending',
      approver_id: null,
      approved_at: null
    };

    // Store request
    await this.storage.save(approvalRequest);

    // Notify approvers (via email, Slack, SMS, etc.)
    await this.notifier.notifyApprovers(approvalRequest);

    // Return request and wait for approval
    return approvalRequest;
  }

  async approveRequest(requestId, approverId, notes = '') {
    const request = await this.storage.get(requestId);

    if (request.status !== 'pending') {
      throw new Error(`Request ${requestId} is not pending`);
    }

    if (new Date() > new Date(request.expires_at)) {
      throw new Error(`Request ${requestId} has expired`);
    }

    request.status = 'approved';
    request.approver_id = approverId;
    request.approved_at = new Date().toISOString();
    request.approver_notes = notes;

    await this.storage.save(request);

    // Audit the approval
    await auditLog({
      timestamp: new Date().toISOString(),
      event_type: 'approval_granted',
      user_id: request.user_id,
      action: request.action,
      approver_id: approverId
    });

    return request;
  }

  async denyRequest(requestId, approverId, reason = '') {
    const request = await this.storage.get(requestId);
    request.status = 'denied';
    request.denier_id = approverId;
    request.denial_reason = reason;

    await this.storage.save(request);

    await auditLog({
      timestamp: new Date().toISOString(),
      event_type: 'approval_denied',
      user_id: request.user_id,
      action: request.action,
      denier_id: approverId
    });
  }
}
```

---

## Cost Tracking

Every external API call tracked:

```javascript
// src/utils/cost-tracker.js

class CostTracker {
  async trackCost(event) {
    const costEvent = {
      id: uuid(),
      timestamp: new Date().toISOString(),
      user_id: event.user_id,
      provider: event.provider,
      operation: event.operation,
      units: event.units,
      cost_per_unit: event.cost_per_unit,
      total_cost: event.units * event.cost_per_unit,
      currency: 'USD'
    };

    await this.storage.append(costEvent);

    // Check cost limits
    const userCosts = await this.getUserMonthlyCosts(
      event.user_id,
      new Date()
    );

    if (userCosts.total > event.monthly_limit) {
      logger.warn(
        `User ${event.user_id} approaching monthly cost limit: $${userCosts.total}`
      );
    }

    return costEvent;
  }

  async getUserMonthlyCosts(userId, date) {
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    return this.storage.query({
      user_id: userId,
      since: monthStart,
      until: monthEnd
    });
  }
}
```

---

## Summary

- **IrisKey Integration**: Verify user identity via biometrics
- **Permission Checking**: Role-based access control
- **Policy Evaluation**: Constraints and limits
- **Cost Estimation**: Pre-action cost checks
- **Approval Gateway**: High-impact action approval
- **Audit Logging**: Immutable event recording
- **Audit Trail Query**: Retrieve historical events
- **Cost Tracking**: Monitor all external API calls

All actions flow through this system. Business logic never skips authorization.
