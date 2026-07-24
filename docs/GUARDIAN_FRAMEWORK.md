# Guardian Framework

**Version**: 1.0.0 (Development)  
**Status**: Foundation components implemented, specific Guardians to follow  
**Compatibility**: Core v1.0, Agent SDK, Echo

## Overview

The Guardian Framework is a modular security-control layer that sits between requests and execution. Every agent action, provider operation, and external capability must pass Guardian evaluation before execution.

**Architectural Rule**:
> No new AI capability may bypass the Guardian Layer. Every new provider and agent action must pass Guardian evaluation before execution.

## Execution Path

```
Request
→ Alpha
→ Guardian Manager
→ Sierra identity and authorisation
→ Uniform governance and compliance
→ Provider or specialist agent
→ Papa validation where applicable
→ Audit and event stream
```

The Guardian Layer supplements Sierra and Uniform. It does not replace or bypass them.

## Guardian Categories

Eight first-class Guardian categories provide comprehensive security coverage:

### 1. Guardian Memory
Protects persistent and retrieved agent memory from poisoning, untrusted instructions and unauthorised modification.

**Scope**: Memory read/write operations, memory updates, data corruption prevention

### 2. Guardian Execution
Evaluates shell commands, code execution, filesystem access, subprocess invocation and tool permissions.

**Scope**: Shell command execution, script evaluation, file operations, subprocess management

### 3. Guardian Network
Evaluates URLs, external API calls, redirects, DNS resolution, SSRF risk and network destinations.

**Scope**: URL validation, external API calls, redirect detection, SSRF prevention

### 4. Guardian Prompt
Detects prompt injection, instruction conflicts, hidden instructions and unsafe context transitions.

**Scope**: Prompt injection detection, instruction safety, context validation

### 5. Guardian Supply Chain
Reviews dependencies, packages, licences, repositories, model provenance and installation risks.

**Scope**: Package installation, dependency verification, licence compliance, model downloads

### 6. Guardian Secrets
Detects credentials, keys, tokens and sensitive values in prompts, logs, files and outbound requests.

**Scope**: Credential detection, secrets scanning, sensitive data prevention

### 7. Guardian Compliance
Applies organisational, legal, regulatory, educational and content policies.

**Scope**: Policy enforcement, regulatory compliance, content policies

### 8. Guardian Audit
Verifies required audit events, correlation references and audit-chain health before and after execution.

**Scope**: Audit verification, event logging, chain integrity

## Core Components

### GuardianManager
Central orchestrator for the Guardian Framework.

```javascript
const { GuardianManager } = require('./src/guardians');

const manager = new GuardianManager();
await manager.initialize();

const result = await manager.evaluate({
  action: 'fetch_url',
  target_provider: 'research-agent',
  network_destinations: ['https://api.example.com']
});

if (result.final_decision === 'allow') {
  // Execute action
} else if (result.final_decision === 'hold_for_authorisation') {
  // Wait for approval
} else {
  // Block execution
}
```

### GuardianRegistry
Registers and manages Guardian adapters.

```javascript
manager.registerGuardian(guardian, {
  display_name: 'Network Guardian',
  implementation_status: 'verified',
  category: 'network'
});
```

### GuardianPolicy
Configuration-driven policy engine that determines required Guardians per action.

```javascript
const policyResult = manager.policy.getRequiredGuardians(context);
console.log(policyResult.required); // Required Guardian IDs
console.log(policyResult.fail_mode); // fail_closed or hold_for_review
```

### GuardianPipeline
Orchestrates sequential or parallel Guardian evaluation.

- Validates context
- Identifies required Guardians
- Executes Guardians with timeout enforcement
- Aggregates results
- Calculates final decision
- Enforces fail-closed policies

### GuardianContext
Structured request context for Guardian evaluation.

```javascript
new GuardianContext({
  evaluation_id: 'eval-123',
  correlation_id: 'corr-456',
  action: 'fetch_url',
  requesting_agent: 'research-agent',
  target_provider: 'search-provider',
  network_destinations: ['https://example.com'],
  privacy_classification: 'internal',
  risk_classification: 'medium',
  deadline: Date.now() + 30000
});
```

**Important**: Do not include raw secrets, unnecessary personal data, biometric material or complete sensitive payloads in GuardianContext.

### GuardianResult
Structured evaluation result from a Guardian.

```javascript
{
  evaluation_id: 'eval-123',
  guardian_id: 'guardian-network',
  guardian_category: 'network',
  decision: 'allow' | 'allow_with_controls' | 'hold_for_authorisation' | 'hold_for_review' | 'deny' | 'unavailable' | 'error',
  risk_level: 'none' | 'low' | 'medium' | 'high' | 'critical',
  confidence: 0.95,
  reasons: ['URL validated', 'No SSRF indicators'],
  findings: [{
    type: 'unsafe_redirect',
    severity: 'high',
    description: 'Redirect to untrusted domain',
    remediation: 'Block redirect or validate destination'
  }],
  required_controls: [{
    type: 'rate_limit',
    description: 'Limit to 10 requests/minute'
  }],
  authorisation_required: false,
  manual_review_required: false
}
```

### GuardianHealthMonitor
Tracks Guardian health and availability.

```javascript
manager.checkAllHealth(); // Returns health status for all Guardians

manager.getHealthStatus(); // Aggregate health
// Returns:
// {
//   manager_initialized: true,
//   registry_stats: { total: 8, enabled: 5, healthy: 5 },
//   aggregate_health: { total_guardians: 8, healthy: 5, degraded: 2, unhealthy: 1 }
// }
```

## Decision Hierarchy

Guardian decisions respect the following precedence:

1. **RBAC denial** always blocks (even if Guardian allows)
2. **Sierra denial** always blocks
3. **Uniform denial** always blocks
4. **Required Guardian denial** blocks
5. **Guardian allow** permits execution
6. **Optional Guardian denial** noted but doesn't block

If a required Guardian is unavailable and fail_mode is `fail_closed`, execution is blocked.

## Fail Modes

### fail_closed
Default. Blocks execution if Guardian is unavailable or uncertain.

**Applies to**:
- High-risk actions (shell, execute_code, install_package)
- Authentication, authorisation, secrets controls
- Restricted actions
- Production environment

### hold_for_review
Requires manual review before proceeding.

**Applies to**:
- Prompt injection detection
- Compliance violations
- Unusual patterns

### fail_open_development_only
Permits execution if Guardian unavailable. **Prohibited in production**.

**Applies to**:
- Development and testing only
- Must be visible in audit logs
- Disabled by default

## Configuration

See `config/guardians.yaml` for:

- Guardian registrations
- Policy definitions
- Fail modes per Guardian
- Health check intervals
- Proposed external tools (not yet integrated)

### Policy Example

```yaml
policies:
  - name: high_risk_execution
    priority: 100
    action: [shell_command, execute_code]
    fail_mode: fail_closed
    required_guardians: [execution, audit]
    optional_guardians: [secrets, compliance]
```

## Policy Matching

Policies are matched based on context:

- `action`: Operation name
- `requesting_role`: User role
- `requesting_agent`: Agent identifier
- `target_provider`: Target provider
- `execution_mode`: sync/async
- `data_classification`: Data sensitivity
- `risk_level`: Inherent risk
- `requires_network`: Network access
- `requires_filesystem`: Filesystem access

First matching policy (by priority) is applied.

## Guardian Pipeline

Default pipeline stages (configurable):

1. Context validation
2. Secrets evaluation
3. Prompt evaluation
4. Memory evaluation
5. Network evaluation
6. Execution evaluation
7. Supply-chain evaluation
8. Compliance evaluation
9. Sierra authorisation
10. Uniform governance
11. Execution
12. Output validation
13. Audit verification

Guardians required for the action are selected from this pipeline.

## Authorisation Precedence

A Guardian `allow` decision **never** overrides:

- RBAC denial
- Sierra denial
- Uniform denial
- Revoked authorisation
- Expired authorisation
- Provider quarantine
- Service draining state

## Events

Guardian Framework emits events for auditing and monitoring:

```
guardian.evaluation_requested
guardian.evaluation_started
guardian.guardian_evaluated
guardian.finding_detected
guardian.allow
guardian.allow_with_controls
guardian.hold_for_authorisation
guardian.hold_for_review
guardian.denied
guardian.unavailable
guardian.error
guardian.health_changed
guardian.policy_changed
guardian.pipeline_completed
guardian.pipeline_failed
guardian.bypass_attempted
```

All events include `correlation_id` and `audit_reference`.

## RBAC Permissions

Guardian management requires:

- `guardian:view` — View Guardian status
- `guardian:evaluate` — Request Guardian evaluation
- `guardian:findings_view` — View findings
- `guardian:sensitive_findings_view` — View sensitive findings
- `guardian:review` — Review held actions
- `guardian:configure` — Configure policies
- `guardian:enable` — Enable Guardian
- `guardian:disable` — Disable Guardian
- `guardian:policy_view` — View policies
- `guardian:policy_manage` — Manage policies
- `guardian:health_view` — View health status
- `guardian:admin` — Full administration

Default: **Deny all**. Only authorised roles may manage Guardians.

## Operation Centre Integration

Guardian Framework integrates with Operation Centre to show:

- Guardian categories and status
- Registered adapters and implementation status
- Enabled/disabled state
- Health status
- Current evaluations
- Recent findings
- Held and denied actions
- Required controls
- Policy version
- Evaluation metrics

Users may:

- Inspect evaluation results
- Review held actions
- Approve or deny through Sierra
- Enable/disable eligible Guardians
- Test Guardian health
- Inspect policies

**No Guardian bypass button exists**. Emergency overrides use break-glass process outside Guardian scope.

## Agent SDK Integration

Agent SDK can access Guardian evaluation:

```javascript
const sdk = AgentSDK.createForAgent(agentCode);

// Pre-execution evaluation
const result = await sdk.getGuardianManager().evaluate({
  action: 'fetch_url',
  network_destinations: ['https://api.example.com']
});

if (result.final_decision !== 'allow') {
  throw new Error('Guardian denied execution');
}
```

Guardian Framework is extension API. Does not break Core v1.0.

## Implementation Status

Current implementation includes:

- ✅ GuardianManager (orchestrator)
- ✅ GuardianRegistry (registration and status)
- ✅ GuardianPolicy (policy engine)
- ✅ GuardianPipeline (evaluation pipeline)
- ✅ GuardianHealthMonitor (health tracking)
- ✅ GuardianBase (adapter interface)
- ✅ GuardianContext (evaluation context)
- ✅ GuardianResult (evaluation result)
- ✅ MockGuardian (testing adapter)
- ⏳ Specific Guardians (Memory, Execution, Network, Prompt, Supply Chain, Secrets, Compliance)

## Security Rules

The Guardian Framework must never:

- Replace server-side RBAC
- Replace Sierra authorisation
- Replace Uniform governance
- Approve its own restricted action
- Silently downgrade a denial
- Convert unavailable mandatory Guardian into approval
- Expose raw secrets in results
- Execute arbitrary shell commands
- Automatically install third-party tools
- Automatically download models or binaries
- Trust provider-supplied safety claims without validation
- Accept unsigned or unverified policy changes in production

## Limitations

This is a **framework foundation**, not a complete security product. Specific Guardians are needed for real enforcement:

- Guardian Memory: Memory protection implementation pending
- Guardian Execution: Code execution analysis implementation pending
- Guardian Network: SSRF and URL validation implementation pending
- Guardian Prompt: Prompt injection detection implementation pending
- Guardian Supply Chain: Dependency scanning implementation pending
- Guardian Secrets: Credential detection implementation pending
- Guardian Compliance: Policy enforcement implementation pending

Do not claim these controls are complete until backed by tested implementations.

## Development Roadmap

### Phase 1 (Current)
- ✅ Framework foundation (Manager, Registry, Policy, Pipeline, Health)
- ✅ Mock adapter for testing
- ✅ Configuration infrastructure
- ✅ Core v1.0 and Echo compatibility
- ✅ Comprehensive framework tests

### Phase 2
- Specific Guardian implementations (Memory, Execution, Network, etc.)
- Integration with real analysis tools
- Production verification

### Phase 3
- Advanced policies and adaptive controls
- Integration with external security tools
- Operational dashboards

## References

- `/src/guardians/` — Implementation
- `/config/guardians.yaml` — Configuration
- `/tests/guardians/` — Tests
- `/docs/GUARDIAN_SDK.md` — SDK integration guide
- `/docs/GUARDIAN_POLICY_MODEL.md` — Policy specification
- `/docs/GUARDIAN_ADAPTER_GUIDE.md` — Creating custom Guardians
- `/docs/GUARDIAN_THREAT_MODEL.md` — Security threat analysis
