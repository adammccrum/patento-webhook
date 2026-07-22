# Sections 9-14: IrisKey Core Technical Systems

## Section 9: Five-Gate Authority Engine

The Five-Gate Authority Engine is the operational core of IrisKey. Every consequential agent action passes through five sequential verification gates. All gates must pass for action approval.

### Gate 1: Identity Gate (1–5ms)
Verifies agent authenticity and current authorization status.
- Validate cryptographic signature on request
- Check agent certificate validity and expiration
- Consult revocation list (agent not revoked?)
- Validate certificate chain (certificate issued by trusted authority?)

**Failure:** Request rejected; invalid identity
**Success:** Agent identity confirmed; proceed to Gate 2

### Gate 2: Policy Gate (10–50ms)
Evaluates whether organizational authorization policies permit the action.
- Retrieve active policies from policy repository
- Match agent identity to assigned roles
- Evaluate policy rules (deterministic logic)
- Check temporal constraints (time windows, rate limits, frequency caps)

**Failure:** Request rejected; policy violation
**Success:** Policy permits action; proceed to Gate 3

### Gate 3: Action Gate (5–20ms)
Verifies the specific action is within agent's authorized scope.
- Verify action type is in authorized action scope (e.g., agent can "read" but not "delete")
- Verify resource is in authorized resource scope (e.g., agent can access customer_data but not admin_logs)
- Verify action parameters are within acceptable ranges
- Prevent scope escalation (agent cannot request broader access during action execution)

**Failure:** Request rejected; scope violation
**Success:** Action within scope; proceed to Gate 4

### Gate 4: Context Gate (50–500ms, can be asynchronous)
Analyzes behavioral context to detect anomalies suggesting compromise.
- Behavioral profiling: Is this action consistent with agent's normal behavior?
- Temporal analysis: Is this action typical for this time of day/week?
- Environmental signals: Source IP, device characteristics, network conditions
- Cross-agent patterns: Is this coordinated with other suspicious requests?

**Output:** Anomaly score (0.0–1.0)
- 0.0–0.3 (Low): Proceed with monitoring
- 0.3–0.7 (Medium): Escalate to human review per policy
- 0.7–1.0 (High): Reject; trigger revocation

**Success:** Anomaly acceptable or escalated; proceed to Gate 5

### Gate 5: Execution Gate (5–10ms)
Confirms system readiness to execute action safely.
- System resources available (CPU, memory, I/O)?
- Audit trail systems operational?
- Execution environment stable?
- Revocation capability active (can we stop this action if needed)?

**Failure:** Request deferred (retry later) or rejected (critical resource unavailable)
**Success:** Systems ready; action execution authorized

### Decision Outcomes

**APPROVE:** All gates pass. Action executes. Token issued for audit trail.
**REJECT:** Any gate fails. Action blocked. Failure reason recorded.
**ESCALATE:** Context Gate medium anomaly. Human review required. Agent notified.
**DEFER:** Execution Gate temporary issue. Retry suggested.

### Performance
- Typical path: 70–585ms
- Most paths: <200ms (caching and parallelization possible)
- Critical paths (identity + policy): <100ms

---

## Section 10: Verified Memory Architecture

Agents maintain persistent state (learned facts, embeddings, context history). This state can be corrupted (memory poisoning attack). IrisKey protects memory integrity through cryptographic techniques.

### Layer 1: Cryptographic Hashing
Every memory record has SHA-3 hash. Modification is instantly detectable.
- Store: hash(record) with record
- Access: Recalculate hash; compare with stored
- Tampering: Hash mismatch immediately detected

Cost: ~1 microsecond per record

### Layer 2: Merkle Tree Structure
Memory organized in Merkle tree (cryptographic tree structure).
- Root hash represents entire memory state
- Partial verification possible (don't need to hash entire KB)
- Proof of inclusion: "This record is part of state X"

Cost: O(log n) verification where n = memory size

### Layer 3: Audit Trail
All memory modifications logged.
- Who modified (agent identity)
- What changed (record ID, old value, new value)
- When (timestamp)
- Why (modification reason)
- Authorization (who approved)

Audit trail entries themselves signed → tamper-evident

### Layer 4: Periodic Snapshots
Full memory state committed at intervals (e.g., hourly).
- Snapshot includes: root hash, timestamp, authority signature
- Enables quick rollback to last verified state
- Supports compliance (full state recovery if compromise detected)

### Integration with Authority Brain
Context Gate includes memory integrity check:
- Is agent's memory state consistent?
- Hash verification succeeds?
- Audit trail consistent?

If memory corruption detected during action → escalate or revoke

### Recovery from Corruption
If tampering detected:
1. Identify corruption point (audit trail analysis)
2. Rollback to last verified snapshot
3. Replay legitimate modifications after corruption point
4. Invalidate agent's actions during corruption period

---

## Section 11: Authority Tokens

Authority Tokens are cryptographic objects encoding authorization. They represent: who is authorized to do what, where, when, and under what conditions.

### Token Structure

```json
{
  "token_id": "auth_xyz...",
  "version": "1.0",
  "issuer": "authority_brain_instance_7",
  "issued_at": "2025-07-22T10:30:00Z",
  
  "subject": {
    "agent_id": "agent_diagnostic_001",
    "agent_type": "diagnostic"
  },
  
  "authorization": {
    "actions": ["read:patient_history", "read:test_results", "recommend:diagnosis"],
    "resources": ["org:healthcare_alpha", "database:patients"],
    "constraints": {
      "max_requests_per_minute": 60,
      "max_records_per_request": 100
    }
  },
  
  "temporal": {
    "valid_from": "2025-07-22T10:30:00Z",
    "valid_until": "2025-07-22T11:30:00Z"
  },
  
  "conditions": {
    "source_ip_whitelist": ["10.0.1.0/24"],
    "require_mfa": false,
    "anomaly_threshold": 0.7,
    "geo_restriction": "within_country"
  },
  
  "revocation": {
    "triggers": ["admin_explicit", "anomaly_high", "policy_violation", "expiry"],
    "revocation_status": "valid"
  },
  
  "signature": "<EdDSA_signature>",
  "key_id": "key_current_2025"
}
```

### Token Lifecycle

1. **Issuance:** Agent requests authorization → Five-Gate evaluation → Token created → Signed
2. **Validation:** Token presented → Signature verified → Claims validated → Conditions checked → Revocation status checked
3. **Use:** Action executes using valid token; audit trail records token_id
4. **Renewal:** Before expiry, agent requests renewal; Five-Gate re-evaluation; new token issued
5. **Revocation:** Explicit (admin command) or automatic (policy, anomaly, expiry)

### Revocation Mechanisms

**Time-Based:** Token expires at valid_until (automatic)
**Anomaly-Triggered:** High-risk behavior detected → immediate revocation
**Policy-Triggered:** Policy change → non-compliant tokens revoked
**Admin-Triggered:** Explicit command → <100ms revocation
**Violation-Triggered:** Policy violation attempt → immediate revocation

### Performance
- Token creation: 150–800ms (includes Five-Gate verification)
- Token validation: 10–100µs (signature verification + cached lookup)

---

## Section 12: Continuous Verification

Authorization is not one-time. Authority must be continuously re-evaluated throughout agent operation.

### Token Renewal
Short-lived tokens (1–2 hours typical). Before expiry, agent requests renewal.
- Renewal request goes through full Five-Gate verification
- If circumstances changed (behavior anomalous, policy tightened): renewal denied
- New token issued only if current conditions support it

### Behavioral Monitoring
Continuous background monitoring:
- Profile "normal" behavior (frequency of actions, types of resources accessed, time patterns)
- Detect deviations (sudden spike in requests, new resource types, unusual times)
- Escalate if deviation significant

### Anomaly Ladder
Escalating responses based on anomaly score:

```
Anomaly 0.0–0.3: LOW
  → Action proceeds
  → Monitoring increased
  → Recorded in audit trail

Anomaly 0.3–0.7: MEDIUM
  → Depends on policy
  → May proceed with restrictions
  → May escalate to human review
  → Escalation logged

Anomaly 0.7–1.0: HIGH
  → Action rejected
  → Token revoked
  → Security team notified
  → Immediate incident response
```

### Policy Refresh
Organizational policies updated periodically (e.g., daily refresh). Authority Brain re-evaluates all active agents against updated policies. If policy tightened: existing authorizations may be reduced or revoked.

### Context Reassessment
Environmental factors affect verification:
- Security patches deployed (threat model changes)
- Related incidents reported (alert level increases)
- Regulatory changes (new compliance requirements)
- Organizational changes (department restructured)

All factors feed into continuous re-evaluation.

---

## Section 13: Deterministic Revocation

Authority is not "revoked later." Authority is active only while conditions are met. Moment conditions change, authority expires immediately.

### Revocation Triggers

**Schedule Expiry:** Token valid_until reached (minutes before, automatic)
**Anomaly Threshold:** Anomaly score exceeds threshold (immediate)
**Policy Violation:** Agent attempted unauthorized action (immediate)
**Admin Action:** Explicit revocation command (<100ms)
**Incident Response:** Emergency revocation (immediate)

### Revocation Process
1. Revocation decision made
2. Token added to centralized revocation list
3. Distributed to all Authority Brain instances (<1 second)
4. All future operations using revoked token rejected
5. In-flight operations interrupted and rolled back
6. Audit entry recorded (revocation reason, timestamp, approver)

### In-Flight Operations
If agent is executing operation when token revoked:
- Operation interrupted immediately
- Partial changes rolled back (if possible)
- Resource state returned to pre-operation condition
- Audit entry marked "revoked_in_flight"
- Forensics available for analysis

### Revocation SLA
- Admin-initiated: <100ms
- Policy-triggered: <1 second
- Anomaly-triggered: <500ms
- Scheduled expiry: Proactive before expiration

---

## Section 14: Multi-Agent Governance

Extending IrisKey from single agents to coordinated multi-agent systems.

### Agent-to-Agent Communication
Agents communicate via signed messages:
- **Direct Authentication:** Each request includes agent identity + signed token
- **Delegation Tokens:** "Agent A authorizes Agent B to perform Action X"
- **Chain of Custody:** Full delegation chain recorded (who delegated to whom)

### Authorization in Multi-Agent Systems

**Hierarchical Authority:**
- Parent agents (orchestrators) have broader scope
- Child agents (specialists) have delegated, narrower scope
- Parents can revoke children; children cannot escalate

**Delegation Scoping:**
- Authority cannot be escalated beyond delegator's scope
- If Agent A has read-only access, cannot delegate write access to Agent B
- Delegation is auditable; chain is recorded

### Multi-Agent Threat Model

| Threat | Mitigation |
|--------|-----------|
| Agent Impersonation | Cryptographic identity verification |
| Privilege Escalation via Delegation | Policy validates delegation scope |
| Agent Collusion | Anomaly detection catches suspicious coordination |
| Replay Attacks | Timestamp + nonce validation |
| Sybil Attacks | Centralized identity registration |

### Orchestration Patterns

**Sequential:** Agent A → Agent B → Agent C
- Explicit handoff with delegation tokens
- Each agent independently verified
- Full audit trail of handoffs

**Parallel:** Coordinator spawns multiple agents
- Each operates independently (cannot escalate to cross-agent scope)
- Coordinator verifies results aggregation
- Prevents collusion through scope isolation

**Hierarchical:** Coordinator + team leads + workers
- Teams isolated; prevent cross-team privilege escalation
- Team lead coordinates within team scope
- Coordinator coordinates across teams

### Scaling
- 3–10 agents: Centralized Authority Brain
- 10–100 agents: Distributed Authority Brain with consensus
- 100+ agents: Hierarchical delegation

---

## Synthesis: Eight-Section Foundation

Sections 7–14 establish complete IrisKey architecture:
- **Identity Before Automation™:** Principle (verify before acting)
- **Dual-Brain:** Architecture (separate reasoning from authorization)
- **Five-Gate Engine:** Verification (deterministic gating)
- **Verified Memory:** State integrity (detect corruption)
- **Authority Tokens:** Authorization representation (cryptographic scoping)
- **Continuous Verification:** Ongoing authorization (re-verify throughout operation)
- **Deterministic Revocation:** Immediate authority withdrawal (automatic expiration)
- **Multi-Agent Governance:** Scaled coordination (trustworthy multi-agent systems)

These eight sections provide complete technical architecture for autonomous AI governance.
