# IrisKey.ai White Paper – Section Outlines

## 1. Executive Summary (2–3 pages)

### Purpose
Standalone summary of the entire paper for busy executives and decision-makers.

### Structure
- **Opening:** The fundamental problem (autonomous AI systems require trust verification before action)
- **Current State:** Inadequacy of existing security models for agentic AI
- **IrisKey Contribution:** What makes this architecture novel
- **Five-Gate Authority Engine:** Core mechanism (1 paragraph)
- **Key Benefits:** Identity verification, continuous authorization, deterministic revocation
- **Scope:** Domains covered (automotive, defence, government, healthcare, banking, infrastructure)
- **Impact:** Regulatory alignment (NIST, ISO), enterprise adoption
- **Conclusion:** Why Identity Before Automation™ is necessary

### Key Claims
- Autonomous AI systems pose fundamentally new governance challenges
- Current security models assume human operator oversight
- IrisKey provides model-agnostic trust layer above any AI architecture
- Applicable across critical domains (defence, healthcare, finance, infrastructure)

---

## 2. Introduction (3–4 pages)

### Purpose
Establish scope, define key terms, motivate the problem.

### Structure
- **Opening Hook:** The paradox of AI capability vs. controllability
- **Problem Statement:** Why autonomous systems require new trust architectures
- **Scope Definition:** 
  - Types of agents covered (conversational AI, autonomous systems, multi-agent swarms)
  - Domains in scope (verified applications)
  - Boundaries (this paper is not about alignment, not about model training, not about AI safety writ large)
- **Key Concepts Introduced:**
  - Agentic AI (definition and taxonomy)
  - Authority vs. capability
  - Deterministic vs. probabilistic control
  - Trust architecture (vs. AI safety)
  - Identity Before Automation™ (high-level)
- **Paper Structure:** Roadmap of 28 sections
- **Intended Audiences:** Academic researchers, enterprise architects, government policy, defence strategists

### Distinguish
- What this paper covers (governance architecture)
- What it doesn't cover (AI alignment, model bias, AGI safety)

---

## 3. Evolution of Agentic AI (3–4 pages)

### Purpose
Historical context: how AI has progressed from static models to autonomous agents.

### Structure
- **Early AI Systems:** Supervised learning, static deployments
- **Conversational AI:** Stateless language models (ChatGPT, Claude, Gemini)
- **Tool-Using AI:** Models with function calling (OpenAI plugins, Claude tools)
- **Autonomous Agents:**
  - ReAct framework (Reasoning + Acting)
  - Multi-step task execution
  - Real-world consequence potential
- **Current State (2024–2026):**
  - Widespread agentic deployment
  - Enterprise adoption accelerating
  - Regulatory pressure mounting
  - Real incidents of prompt injection, misuse
- **Future Trajectory:**
  - Long-running agents (weeks/months)
  - Multi-agent coordination
  - Increasingly consequential decisions
  - Need for trustworthy governance

### References
- ReAct (Yao et al.)
- AutoGPT, BabyAGI emergence
- Industry frameworks (LangChain, AutoGen, CrewAI)
- NIST AI RMF timeline

---

## 4. Current Threat Landscape (4–5 pages)

### Purpose
Establish urgency: demonstrate real vulnerabilities in deployed agentic systems.

### Structure
- **Threat Categories:**
  1. **Prompt Injection** – Adversarial inputs, indirect injection
  2. **Tool Misuse** – Unauthorized access to external systems
  3. **Memory Corruption** – Persistent state manipulation
  4. **Credential Theft** – API key compromise
  5. **Cross-Agent Attacks** – One agent compromising another
  6. **Supply-Chain Threats** – Compromised models or dependencies
  7. **Insider Misuse** – Authorized operators abusing authority
  8. **Privilege Escalation** – Agents expanding their own authority
  9. **Agent Impersonation** – False identity claims
  10. **Context Manipulation** – Reasoning distortion
  11. **Rogue Agents** – Deliberately malicious autonomous systems

- **Incident Examples:** 
  - Real-world prompt injections (documented cases)
  - Autonomous system failures in controlled environments
  - Supply-chain compromises in ML systems
  - Multi-agent confusion scenarios

- **Scale of Risk:**
  - Deployed agents in enterprise (thousands+)
  - Critical domain applications emerging
  - Regulatory scrutiny increasing
  - Insurance/liability implications

- **Why Traditional Security Falls Short:**
  - Autonomous systems bypass human decision gates
  - Reasoning is probabilistic, not auditable
  - Tool access can't be "locked down" without breaking functionality
  - Continuous operation vs. one-time transactions

### References
- Prompt injection research (Carlini et al., Zou et al.)
- Recent AI incidents (publicly documented)
- Supply-chain security in ML (various NIST docs)

---

## 5. Literature Review (5–7 pages)

### Purpose
Comprehensive survey of related research and frameworks.

### Structure

#### A. AI Governance & Safety
- Recent frameworks for AI safety
- Regulatory approaches (EU AI Act, UK frameworks)
- Industry best practices
- Open problems in AI controllability

#### B. Secure Multi-Agent Systems
- Byzantine fault tolerance
- Trust in multi-agent environments
- Secure delegation protocols
- Agent authentication and verification

#### C. Identity and Access Management (IAM)
- Traditional IAM principles
- Continuous verification (Zero Trust)
- Attribute-based access control (ABAC)
- Cryptographic identity proofs

#### D. Cryptographic Foundations
- Digital signatures and verification
- Hash-based audit trails
- Threshold cryptography
- Quantum-resistant cryptography

#### E. Formal Methods
- Formal verification of systems
- Security protocol verification
- Deterministic authorization models

#### F. Existing Governance Frameworks
- NIST AI RMF (detailed)
- ISO/IEC 42001 (AI management)
- ISO/IEC 27001 (information security)
- Zero Trust Architecture (NIST SP 800-207)
- NCSC AI Security Roadmap

### Synthesis
- What existing literature covers well
- Critical gaps that motivated IrisKey
- How IrisKey complements existing frameworks

### References
- 40–50 papers/standards in this section alone

---

## 6. Why Current Security Models Are Insufficient (3–4 pages)

### Purpose
Bridge from threat landscape and literature to the need for a new architecture.

### Structure

#### Traditional Security Assumptions
- Assumption: Operators approve consequential actions
- Assumption: Static, pre-defined security policies
- Assumption: Systems operate within controlled boundaries
- Reality: Agents make real-time decisions; humans-in-loop is infeasible at scale

#### Gap Analysis
1. **Zero Trust Applied to AI:**
   - ZT assumes human operators make decisions
   - AI agents can operate faster than verification becomes practical
   - No standard for "continuous verification" of autonomous action
   
2. **NIST AI RMF Limitations:**
   - Excellent framework for governance processes
   - Doesn't specify technical architecture for authorization
   - Gap between policy-level and execution-level trust

3. **Traditional IAM Issues:**
   - Built for human authentication + static roles
   - Doesn't account for:
     - Agent reasoning quality
     - Dynamic authority based on context
     - Deterministic revocation of autonomous action
   - Assumes humans will catch policy violations

4. **Access Control Problems:**
   - RBAC assumes humans perform actions
   - ABAC more flexible but still assumes human judgment at critical points
   - Neither designed for sub-second authorization at scale

#### Why a New Architecture Is Needed
- Unprecedented combination of autonomy + real-world consequence
- Need for model-agnostic trust layer
- Requirement for deterministic, not probabilistic, control
- Necessity of continuous verification, not periodic audits

### Technical Gaps
- No standard for "authority token" lifecycle in agentic context
- No proven architecture for verified agent memory
- No established pattern for "five-gate" sequential authorization
- Unclear how to revoke agent autonomy deterministically in flight

---

## 7. Identity Before Automation™ (4–5 pages)

### Purpose
Articulate the core philosophical and technical principle underlying IrisKey.

### Structure

#### The Principle
- **Core Insight:** Authority must precede autonomy
- **Reason:** AI systems must be continuously verified as trustworthy BEFORE each consequential action, not evaluated after
- **Distinction:** 
  - "Safety" = AI won't do harm (probabilistic, alignment-focused)
  - "Trust Architecture" = AI will only do authorized actions (deterministic, control-focused)

#### Identity as Foundation
- **What is Identity?** Cryptographic proof of agent origin + lineage
- **Why Identity Matters:** Enables accountability and traceability
- **Static vs. Dynamic Identity:**
  - Static: "This is Agent X" (registration)
  - Dynamic: "Agent X is currently authorized to perform Action Y under Condition Z" (verification)

#### Three Operational Principles
1. **Verify Before Permitting**
   - Don't assume agent is authorized based on prior checks
   - Re-verify authority for each action (or action class)
   - Cost-benefit: computational overhead vs. risk

2. **Continuous Accountability**
   - Every action is recorded with identity proof
   - Audit trail is cryptographically signed
   - Retrospective detection of drift or compromise

3. **Deterministic Revocation**
   - Authority is not "revoked later"
   - Authority is *active* only while conditions are met
   - Revocation takes effect immediately (no lag)

#### Formalization
- Define "identity" in cryptographic terms
- Define "authority" as (agent, action, resource, time, conditions)
- Define "verification" as continuous re-evaluation of authority
- Define "revocation" as deterministic transition to (no authority)

#### Contrast with Existing Models
- Blockchain identity (too broad; doesn't address authorization)
- Traditional digital signatures (address authenticity, not ongoing authority)
- Access control lists (static, not continuous)

### Key Figure
- High-level diagram: "Identity Before Automation™" principle

---

## 8. Dual-Brain Architecture (4–5 pages)

### Purpose
Explain how IrisKey separates reasoning (AI capability) from authority (trust verification).

### Structure

#### The Reasoning Brain
- **Function:** Perform inference, reasoning, planning
- **Model-Agnostic:** Works with any LLM/RL system
- **Outputs:** Proposed action + justification + confidence
- **NOT responsible for:** Authorization, policy enforcement, revocation

#### The Authority Brain
- **Function:** Evaluate if proposed action is authorized
- **Deterministic:** Rules-based, not learning-based
- **Inputs:** 
  - Agent identity
  - Proposed action
  - Resource/asset at risk
  - Current conditions (time, context, anomalies)
  - Active authority tokens
  - Policy evaluation
- **Outputs:** Approve / Reject / Escalate + explanation
- **NO confusion:** Authority brain never "reasons"; it verifies

#### Key Separation
- **Reasoning Brain** answers: "What should I do?"
- **Authority Brain** answers: "Are you authorized to do it?"
- **These are fundamentally different operations**

#### Workflow
1. Agent formulates action → Reasoning Brain
2. Reasoning Brain outputs proposal
3. Proposal sent to Authority Brain
4. Authority Brain verifies identity + policy + conditions
5. If approved: Execution engine acts; audit trail recorded
6. If rejected: Reason communicated back; action blocked
7. If escalated: Human/admin notified for decision

#### Why Separation Matters
- **Reducing Attack Surface:**
  - Exploit of reasoning system doesn't grant authority
  - Reasoning system can't be tricked into "authorizing itself"
- **Auditability:**
  - Authority decisions are explicit and reviewable
  - Can't hide behind "the AI decided"
- **Performance:**
  - Reasoning can be sophisticated (slow, complex)
  - Authorization is fast (optimized, cached where safe)
- **Evolution:**
  - Reasoning systems can be updated (improved models)
  - Authority rules can be hardened independently
- **Model Agnosticism:**
  - Any reasoning engine can plug into same Authority Brain
  - Authority rules are engine-independent

#### Technical Boundaries
- **No data flow from Reasoning to Authority** beyond the proposed action
- **No feedback from Authority to Reasoning** beyond approval/rejection
- **Authority decisions are immutable** once recorded

### Key Figures
- Dual-brain architecture diagram
- Information flow (action proposal → authorization → execution)
- Comparison: monolithic vs. dual-brain

---

## 9. Five-Gate Authority Engine (5–6 pages)

### Purpose
Define the core technical mechanism: sequential verification gates that an action must pass.

### Structure

#### Gate 1: Identity Gate
- **Question:** "Is this request from a valid agent with verified identity?"
- **Verification:**
  - Cryptographic signature validation
  - Agent certificate check
  - Revocation list consultation
  - Chain-of-custody validation (lineage proof)
- **Failure Mode:** Request rejected; alert logged
- **Output:** Identity token (valid/invalid) + agent metadata

#### Gate 2: Policy Gate
- **Question:** "Do current authorization policies permit this action class?"
- **Verification:**
  - Active policy retrieval (from policy repository)
  - Policy rule evaluation (deterministic)
  - Role/capability matching
  - Time-based policy enforcement (time windows, rate limits)
- **Failure Mode:** Request rejected; policy violation logged
- **Output:** Policy verdict (allowed/denied) + reason

#### Gate 3: Action Gate
- **Question:** "Is the specific action within the agent's authorized scope?"
- **Verification:**
  - Resource being accessed is allowed
  - Action type (read/write/execute) is authorized
  - Parameters are within acceptable ranges
  - Scope boundaries enforced (e.g., no cross-tenant access)
- **Failure Mode:** Request rejected; scope violation logged
- **Output:** Action verdict (approved/denied) + scope confirmation

#### Gate 4: Context Gate
- **Question:** "Does the request context show signs of compromise or anomaly?"
- **Verification:**
  - Behavioral anomaly detection
  - Temporal patterns (is this action typical for this agent?)
  - Frequency analysis (rate-of-requests within norms?)
  - Context consistency (do parameters align with typical usage?)
  - Environmental signals (source IP, device, network conditions)
- **Failure Mode:** Request escalated to human review or rejected depending on policy
- **Output:** Risk assessment (low/medium/high) + anomaly flags

#### Gate 5: Execution Gate
- **Question:** "Can the action be executed safely, and can we monitor/revoke it?"
- **Verification:**
  - Resource availability (system not overloaded)
  - Audit trail ready (logging pipeline functional)
  - Execution context stable
  - Revocation capability available (system can kill the action if needed)
- **Failure Mode:** Request rejected; resource unavailable
- **Output:** Execution permission (granted/deferred) + monitoring parameters

#### Sequential Design
- **All gates must pass** (AND logic, not OR)
- **Gates run in order** (early failures prevent downstream processing)
- **Gates are independent** (Gate 3 doesn't see Gate 1 decision, only the identity output)
- **Optimizations possible** (caching, parallel execution where safe) but must preserve semantics

#### Decision Outcomes
| Result | Definition | Example |
|--------|-----------|---------|
| **Approve** | All gates pass; execution proceeds | Agent with valid identity, current policy, matching action, normal context, execution ready → approve |
| **Reject** | Gate fails; action blocked immediately | Invalid signature → reject |
| **Escalate** | Context gate detects anomaly; human review needed | Unusual request pattern → escalate |
| **Defer** | Temporary resource issue; retry possible | System temporarily overloaded → defer |

#### Performance Considerations
- Gate 1 (Identity): ~1–5ms (crypto verification)
- Gate 2 (Policy): ~10–50ms (policy evaluation)
- Gate 3 (Action): ~5–20ms (scope checking)
- Gate 4 (Context): ~50–500ms (anomaly scoring, can be asynchronous)
- Gate 5 (Execution): ~5–10ms (resource check)
- **Total typical path:** 70–585ms (most paths much faster)

#### Relationship to Threat Model
- **Prompt Injection:** Caught at Action Gate (unauthorized action request)
- **Privilege Escalation:** Caught at Gate 2, 3, 4 (policy violation)
- **Credential Theft:** Identity compromised; caught at Gate 1 (revocation list)
- **Supply-Chain Compromise:** Caught at Gate 1 (signature validation) or Gate 4 (behavioral anomaly)
- **Rogue Agents:** Caught immediately by all gates (not registered, not authorized)

### Key Figures
- Five-Gate flowchart
- Gate decision matrix
- Performance timeline
- Threat coverage matrix

---

## 10. Verified Memory Architecture (4–5 pages)

### Purpose
Explain how agent memory (learned knowledge, context, history) is protected from tampering.

### Structure

#### The Problem
- Agents learn from interactions; they develop persistent state
- This learned state can be corrupted (memory poisoning)
- Traditional databases aren't designed for cryptographic integrity
- AI systems don't naturally produce verifiable evidence of correct operation

#### Integrity Layers

##### Layer 1: Cryptographic Hashing
- Every memory record has a cryptographic hash (SHA-3, quantum-resistant alternatives)
- Memory updates include previous hash (chain of custody)
- Tampering detection: recalculate hash vs. stored hash
- Cost: ~microseconds per record

##### Layer 2: Merkle Trees
- Memory organized in Merkle tree structure
- Root hash represents entire knowledge base state
- Partial verification possible (don't need to hash entire KB)
- Enables efficient proofs: "This record is consistent with root hash R"

##### Layer 3: Audit Trail
- All memory modifications logged with:
  - Timestamp
  - Initiating agent identity
  - Change description (what was added/modified)
  - Cryptographic signature by authority
- Audit trail itself is tamper-evident (linked list of signed entries)

##### Layer 4: Periodic Snapshots
- At intervals, full memory state is cryptographically committed
- Snapshot includes root hash + timestamp + authority signature
- Creates checkpoints for compliance and recovery

#### Memory Types

##### Ephemeral Memory
- Conversation history within single session
- Less critical for integrity (expires quickly)
- Hashed but not necessarily audited

##### Persistent Memory
- Learned facts, embeddings, policies
- Critical for integrity
- Full audit trail required

##### System Memory
- Agent configuration, capabilities, policies
- Highest integrity requirements
- Read-only or change-logged

#### Verification Workflow
1. Agent accesses memory record
2. System verifies hash matches current value
3. If mismatch detected: corruption flagged; alert triggered
4. Audit trail consulted: identify when/how corruption occurred
5. Root cause analysis: was memory modified by unauthorized actor? Bit flip? Attack?

#### Integration with Authority Brain
- Authority Brain can check: "Is this agent's memory state consistent and unmodified?"
- Used in Gate 4 (Context Gate): behavioral anomalies might indicate memory corruption
- Revocation can include: "Clear this agent's memory due to detected tampering"

#### Performance & Scalability
- Hashing: ~1µs per record (negligible overhead)
- Merkle tree verification: O(log n) where n = memory size
- Audit trail: O(1) append (write-optimized)
- Snapshot size: proportional to memory size (few seconds per GB typically)

#### Limitations & Future Work
- Performance at extreme scale (agent with TB of memory)
- Quantum-resistant hash functions still evolving
- Privacy vs. auditability tradeoff

### Key Figures
- Merkle tree structure diagram
- Memory integrity layers
- Audit trail example
- Hash chain concept

---

## 11. Authority Tokens (4–5 pages)

### Purpose
Define the lifecycle and structure of cryptographic tokens that grant authority.

### Structure

#### Token Anatomy
```
{
  "version": "1.0",
  "token_id": "auth_<uuid>",
  "issuer": "authority_brain_instance_id",
  "subject": "agent_<agent_id>",
  "action_scope": ["read:documents", "write:drafts"],
  "resource_scope": ["org:acme", "project:alpha"],
  "issued_at": "2025-07-22T10:30:00Z",
  "valid_from": "2025-07-22T10:30:00Z",
  "valid_until": "2025-07-22T18:30:00Z",
  "conditions": {
    "source_ips": ["10.0.1.0/24"],
    "max_requests_per_minute": 100,
    "require_mfa": true,
    "anomaly_threshold": 0.7
  },
  "revocation_triggers": ["admin_revoke", "anomaly_high", "schedule_expiry"],
  "issuer_signature": "<digital_signature>",
  "verification_path": "..."
}
```

#### Issuance Process
1. Agent requests authority for specific action
2. Authority Brain evaluates (Five Gates)
3. If approved: token generated
4. Token signed by Authority Brain private key
5. Token returned to agent
6. Agent includes token in action request

#### Token Scopes

##### Action Scope
- Specific operations permitted
- Examples: "read:documents", "write:logs", "execute:scripts"
- Enables principle of least privilege
- Can be hierarchical (read:* includes read:documents, read:logs)

##### Resource Scope
- Which resources/assets can be accessed
- Examples: "org:acme", "database:customers", "bucket:archive"
- Supports multi-tenancy boundaries
- Enables resource-level access control

##### Temporal Scope
- Valid from / until (lifetime)
- Examples: 1 hour, 8 hours, 7 days
- Can be time-windowed (valid only during business hours)
- Reduces window of compromise if token is stolen

##### Conditional Scope
- Additional constraints:
  - Source IP whitelists
  - Rate limits
  - MFA requirements
  - Device trust requirements
  - Geo-fencing
  - Require specific Authority Brain instance

#### Revocation Triggers

##### Automatic Triggers
- **Schedule Expiry:** Token expires at valid_until time
- **Anomaly Detection:** Context Gate detects high-risk behavior → revoke
- **Privilege Reduction:** Policy updated → existing tokens revoked
- **Agent Compromise:** Identity compromised → all tokens revoked

##### Administrative Triggers
- **Explicit Revocation:** Admin/security team revokes token
- **Audit Finding:** Post-incident analysis → retroactive revocation
- **Compliance Requirements:** Regulatory requirement → revoke

##### Behavioral Triggers
- **Policy Violation:** Token used to attempt unauthorized action → revoke
- **Escalation Threshold:** Repeated policy violations → revoke

#### Verification Process (at execution time)
1. Agent submits action with token
2. System verifies token signature (authentic issuance)
3. System checks valid_from / valid_until (temporal)
4. System checks conditions (IP, rate limit, MFA, etc.)
5. System confirms revocation not triggered
6. System confirms scopes match requested action/resource
7. If all pass: action proceeds; if any fail: action blocked

#### Comparison with JWT/OAuth
- **Similarities:** Signed token, claims-based
- **Differences:**
  - Revocation is deterministic and immediate (not eventually consistent)
  - Conditions include behavioral/contextual factors
  - Designed for sub-second verification at scale
  - Integrated with Authority Brain, not generic OIDC server

#### Token Lifecycle Diagram
```
Issued → Valid → [Conditions Checked] → Action Executed → Token Consumed
       → [Anomaly Detected] → Revoked
       → [Trigger Hit] → Revoked
       → [Schedule Expires] → Expired
```

#### Cryptographic Foundation
- Algorithm: EdDSA or ECDSA (quantum-resistant alternatives in roadmap)
- Key rotation: Keys rotated quarterly (or on compromise)
- Audience: Token is specifically for stated Authority Brain instance
- Non-repudiation: Signature proves issuance by Authority Brain

#### Performance
- Token size: ~500 bytes typical
- Signature verification: ~1ms
- Revocation check: ~10–100µs (cached revocation lists)

### Key Figures
- Token lifecycle diagram
- Token anatomy breakdown
- Revocation decision tree
- Scoping model

---

## 12. Continuous Verification (4–5 pages)

### Purpose
Explain how authorization is not one-time, but ongoing and renewable.

### Structure

#### The Problem with One-Time Verification
- Traditional auth: verify at login; assume verified for session
- Problem in agentic context: agent can drift into unauthorized territory during long operations
- Solution: Continuous re-verification

#### Continuous Verification Model

##### Token Renewal
- Short-lived tokens (1 hour typical)
- Agent must request renewal before expiry
- Renewal request goes through Five Gates again
- If conditions have changed (policy updated, behavior anomalous): renewal can be denied
- Token expiry = automatic capability loss

##### Behavioral Monitoring
- Authority Brain continuously monitors agent actions
- Profiles normal behavior (request frequency, resource types, time patterns)
- Detects deviations:
  - Sudden spike in requests (possible escalation attempt)
  - Access to new resource types (scope expansion)
  - Off-hours access (temporal anomaly)
  - Requests from unusual locations (network anomaly)
  - Unusual parameter values (context anomaly)

##### Anomaly Response Ladder
1. **Normal:** Action proceeds; behavior recorded
2. **Low Anomaly (0–0.3):** Action proceeds; monitoring increased; recorded
3. **Medium Anomaly (0.3–0.7):** 
   - If policy allows: action proceeds; escalation level increased
   - If policy demands: action escalated for human review
4. **High Anomaly (0.7–1.0):**
   - Action blocked immediately
   - Escalated to security team
   - Token revoked
   - Agent may be suspended pending investigation

##### Policy Refresh
- Policies aren't static; they update
- Authority Brain periodically re-evaluates active agents against current policies
- If policy tightens: agent authority reduced
- If policy loosens: agent can request expanded authority (goes through Five Gates)

##### Context Reassessment
- Environmental factors change:
  - Security patches deployed (change threat model)
  - Related incidents (increase alert level)
  - Regulatory changes (new constraints)
  - Time-of-day (business hours vs. after-hours access)
- Authority Brain factors these into verification decisions

#### Continuous Verification Workflow

```
T0: Agent requests action
  → Five Gates evaluation
  → Token issued (valid for 1 hour)

T0–T30: Agent operates
  → Each action verified against token
  → Behavioral monitoring ongoing
  → No anomalies detected
  → Operations continue normally

T30: Behavioral drift detected
  → Anomaly score increases
  → Alert issued to security monitoring
  → Policy review triggered
  → Token not revoked (yet; low anomaly)

T45: Another policy violation
  → Anomaly score now high
  → Token revoked automatically
  → Agent informed: authority suspended
  → Security team notified

T60: Token would have expired anyway
  → Renewal requested by agent
  → Five Gates evaluation (with history of violations)
  → Renewal denied; escalated to admin
  → Admin investigates, approves cautious resumption
  → New restrictive token issued
```

#### Verification vs. Revocation
- **Verification:** "Are you still authorized?" (yes/no, triggered continuously)
- **Revocation:** "You are no longer authorized" (immediate, with cause)
- **Connection:** Failed verification → triggers revocation

#### Performance & Cost
- Monitoring: Continuous but low-cost (background process)
- Anomaly scoring: O(1) to O(log n) depending on method
- Policy refresh: Happens daily or on-demand
- Re-evaluation: Triggered by token renewal (hourly default)
- Total overhead: <1% CPU for typical deployment

#### Detection Limitations
- Zero-day exploits may not trigger anomalies (if behavior appears normal)
- Sophisticated attackers may gradually escalate (boiling frog)
- Trade-off between sensitivity and false positives
- Requires multi-stage detection (behavior + other signals)

### Key Figures
- Continuous verification timeline
- Anomaly ladder and response
- Monitoring pipeline architecture
- Policy refresh workflow

---

## 13. Deterministic Revocation (4–5 pages)

### Purpose
Define how authority is immediately and irreversibly removed.

### Structure

#### Revocation vs. Denial
- **Denial:** Request rejected during Five Gates (never authorized)
- **Revocation:** Authority that was granted is now cancelled
- **Key Difference:** Revocation requires cleanup (tokens, active operations, memory)

#### Revocation Triggers (revisited from Authority Tokens section)

| Trigger | Latency | Process |
|---------|---------|---------|
| Schedule Expiry | Minutes before | Proactive; cleanup scheduled |
| Anomaly Threshold Hit | <1 second | Immediate; interrupt operations |
| Admin Action | <100ms | Immediate; audit log entry |
| Policy Change | <1 second | Immediate; re-evaluate all active agents |
| Incident Response | <100ms | Immediate; emergency revocation |

#### Revocation Mechanisms

##### Token Revocation
- Remove token from valid set
- Add to revocation list (CRL-like structure)
- Publish revocation: all Authority Brain instances update their revocation list
- Existing actions using revoked token: checked at next gate

##### Operation Revocation
- Agent has in-flight operation (long-running task)
- Revocation triggered during execution
- Authority Brain sends interruption signal
- Agent must cease operation within SLA (e.g., 1 second)
- Unsafe states: rolled back or emergency-halted
- Result: logged with revocation reason

##### Agent Suspension
- Entire agent revoked (not just a token)
- All tokens invalidated
- All in-flight operations interrupted
- Agent cannot request new tokens until reinstated
- Used for: compromise response, termination, quarantine

#### Revocation Latency
- **Optimal:** <100ms for admin-initiated revocation
- **Typical:** <1 second for policy-triggered revocation
- **Acceptable:** Minutes for scheduled expiry
- **Critical Path:** Revocation list propagation must be faster than token re-validation in distributed setup

#### Implementation: Revocation List vs. Certificate

##### Revocation List (CRL) Approach
- Centralized list of revoked tokens/agents
- Checked during verification
- Pros: Simple, definitive
- Cons: Centralized failure point; latency if network issue

##### Certificate Approach (Short-lived Tokens)
- Tokens expire quickly (1–60 minutes)
- No explicit revocation needed; just wait for expiry
- Pros: No revocation infrastructure needed
- Cons: Grace period before revocation takes effect (token lifetime)

##### Hybrid Approach (Recommended)
- Short-lived tokens (1 hour) + revocation list
- Scheduled expiry: handled by token expiry
- Emergency revocation: explicit CRL entry
- Best of both: low-latency revocation + eventual consistency fallback

#### Revocation & In-Flight Operations

##### Problem
- Agent is executing long operation
- Mid-operation, agent is revoked
- Operation is using revoked authority
- What happens?

##### Solutions by Operation Type

| Operation Type | Response | Example |
|---|---|---|
| **Read-only** | Abort immediately; return cached result if available | "Summarize document" mid-way → abort |
| **Write to system** | Rollback if possible; halt if already committed | "Write to database" → rollback transaction |
| **External service call** | Abort new calls; monitor in-flight | "Call external API" → wait for response; don't make new calls |
| **Computation** | Abort; discard result | "Complex model inference" → stop; discard output |
| **Physical action** (robots, vehicles) | **EMERGENCY STOP** | Autonomous vehicle → engage brakes immediately |

#### Revocation Cascade
- When agent is revoked, what about:
  - Sub-agents it has spun up? → Revoked
  - Data it has cached? → Invalidated
  - Delegated authority? → Revoked
  - Downstream effects? → Logged and analyzed
- Cascade policy: system ensures no orphaned authority

#### Audit Trail of Revocation
```
{
  "event_type": "revocation",
  "timestamp": "2025-07-22T11:45:32Z",
  "revocation_reason": "anomaly_threshold_exceeded",
  "subject": "agent_alpha_001",
  "revoked_by": "authority_brain_instance_7",
  "anomaly_score": 0.92,
  "operations_interrupted": 3,
  "tokens_revoked": 5,
  "audit_signature": "<digital_signature>"
}
```

#### Revocation SLA
- **Admin-initiated:** <100ms
- **Policy-triggered:** <1 second
- **Anomaly-triggered:** <500ms
- **Scheduled expiry:** Proactive before expiration time

### Key Figures
- Revocation lifecycle diagram
- Trigger decision tree
- In-flight operation response matrix
- Revocation latency timeline

---

## 14. Multi-Agent Governance (4–5 pages)

### Purpose
Extend IrisKey from single-agent to multi-agent systems and swarms.

### Structure

#### The Multi-Agent Challenge
- Single agent with identity, tokens, authority: clear
- Multiple agents interacting: who authorizes what?
- Agent-to-agent calls: are they subject to Five Gates?
- Privilege escalation across agent network: how to prevent?
- Agent collusion: can multiple agents combine authority to exceed limits?

#### Agent-to-Agent Authentication
- **Direct Authentication:** Agent A calls Agent B
  - Agent A includes its identity + signed token
  - Agent B verifies A's identity and token
  - Agent B enforces its own access control (Agent A is just another requestor)
  
- **Delegation Tokens:** Agent A delegates authority to Agent B
  - Agent A creates delegation token: "Agent B is authorized to X on my behalf"
  - Agent A signs token with its authority
  - Agent B uses delegation token for the actual operation
  - Enables transitive authority while maintaining audit trail

- **Chain of Custody:** Tracking delegation
  - A delegates to B, B delegates to C
  - Full chain recorded in audit trail
  - Revocation of A cascades to B and C (if derived from A)

#### Authorization Scope in Multi-Agent Systems

##### Hierarchical Authority
- Parent agents (orchestrators) have broader authority
- Child agents (specialists) have narrower, delegated authority
- Parents can revoke children; children cannot escalate to parent level
- Example: HR orchestrator → recruiting agent, payroll agent (restricted scopes)

##### Cross-Cutting Concerns
- **Shared Resources:** Multiple agents accessing same database
  - Each agent verified independently
  - Database enforces access control (defense-in-depth)
  - Audit trail logs each access
  
- **Conflicting Policies:** Policies favor different agents
  - Deterministic conflict resolution (defined policy takes precedence)
  - Escalation if policies contradict
  - Logging of all conflicts

#### Multi-Agent Threat Model

| Threat | Definition | Mitigation |
|--------|-----------|-----------|
| **Agent Impersonation** | Rogue agent claims to be Agent A | Identity verification at every handoff; cryptographic signatures |
| **Privilege Escalation via Delegation** | Agent A delegates more authority than it has | Authority Brain validates: delegation cannot exceed delegator's scope |
| **Agent Collusion** | Two agents coordinate to exceed combined authority | Behavioral anomaly detection; transaction-level cross-validation |
| **Replay Attacks** | Old delegation token replayed | Timestamps + nonce validation; tokens include operation ID |
| **Sybil Attacks** | Attacker creates many agent identities | Centralized identity registration; each identity tied to real entity |

#### Orchestration Patterns

##### Sequential Agents
- Agent A completes task → hands off to Agent B → hands off to Agent C
- Each handoff includes delegation + context transfer
- Each agent can validate: "Is previous agent authorized to pass this off?"

##### Parallel Agents
- Orchestrator spawns multiple agents to work on subtasks
- Aggregator collects results
- Authority: each parallel agent limited to its subtask scope
- Results validation: aggregator verifies result integrity

##### Hierarchical Swarms
- Coordinator agent
  - Team lead agents (each supervises a team)
    - Worker agents (perform specific tasks)
- Authority flows from top down; accountability flows up
- Compromise of worker doesn't escalate to coordinator (limited scope)
- Compromise of coordinator affects all subordinates (cascading revocation)

#### Multi-Agent Audit Trail
- Single unified audit log for system
- Each event includes agent identity + operation + scope + timestamp
- Enables full reconstruction of multi-agent workflow
- Supports tracing: "How did this state occur?" via agent interactions

#### Scaling Multi-Agent Governance
- **Small groups (3–10 agents):** Centralized Authority Brain
- **Medium groups (10–100):** Distributed Authority Brain with consensus
- **Large swarms (100+):** Hierarchical Authority Brain with delegated governance
- **Cross-organizational:** Federated Authority Brains with trust anchors

#### Collusion & Quorum Requirements
- **No collusion possible if:** Each agent individually verified for each action
- **Reduced collusion risk if:** Independent verification of multi-agent results
- **Require quorum if:** Critical operations need approval from >1 agent
  - Example: "Transfer >$1M requires approval from 2 independent agents"
  - Each agent independently verified; both must approve

### Key Figures
- Multi-agent system architecture
- Delegation chain diagram
- Hierarchical authority structure
- Orchestration patterns (sequential, parallel, hierarchical)
- Multi-agent threat matrix

---

## 15. Enterprise Architecture (4–5 pages)

### Purpose
Detail how IrisKey deploys in large enterprise environments.

### Structure

#### Enterprise Deployment Model

##### Zero Trust Foundation
- IrisKey aligns with Zero Trust principles (NIST SP 800-207)
- Every request verified; no implicit trust zones
- Identity and context drive access decisions
- Assume breach: design for detection and containment

##### Architecture Layers
1. **Identity Layer:** Agent registration, credential issuance
2. **Authority Layer:** Authority Tokens, policy engine
3. **Verification Layer:** Five Gates, continuous monitoring
4. **Execution Layer:** Action enforcement, resource access
5. **Audit Layer:** Comprehensive logging, forensics

##### High Availability & Redundancy
- Authority Brain instances in active-active or active-passive
- Distributed revocation list caching
- Token verification fallback to cached state (if primary unavailable)
- Orchestration via service mesh or load balancers

#### Integration with Enterprise Systems

##### Identity Management (IAM)
- IrisKey complements enterprise IAM (Okta, Azure AD, etc.)
- Enterprise user → agent registration
- Agent identity pinned to enterprise identity
- Enterprise IAM drives policy updates to IrisKey

##### Logging & SIEM Integration
- IrisKey logs flow to central log repository (Splunk, ELK, etc.)
- Audit trail queryable for compliance
- Real-time alerts to SIEM on anomalies
- Forensic replay capability

##### Secrets Management
- Agent credentials stored in vault (HashiCorp, AWS Secrets Manager)
- IrisKey verifies agent has access to credential before approving operation
- Secrets rotated on schedule
- Compromise triggers immediate revocation

##### API Gateway Integration
- IrisKey can sit in API gateway layer
- Incoming requests: API Gateway → IrisKey authorization → backend
- Enables central enforcement without modifying every backend service
- Supports legacy systems not AI-aware

#### Policy Management in Enterprise
- **Policy Authority:** IT Security or Compliance team owns policy
- **Policy Update Workflow:**
  1. Policy change requested
  2. Change approval workflow (may involve stakeholders)
  3. Policy updated in central repository
  4. Authority Brain instances refresh policy cache
  5. Existing tokens evaluated against new policy
  6. Non-compliant tokens revoked or escalated
  7. Audit: all policy changes logged

- **Policy Versioning:** Maintain history of policy changes
- **Policy Rollback:** If policy causes issues, can be rolled back
- **A/B Testing:** Can deploy policy to subset of agents for validation

#### Multi-Tenant Enterprise
- **Tenant Isolation:** Agent scopes limited to their tenant's resources
- **Cross-Tenant Requests:** Explicitly disallowed unless specially authorized
- **Shared Services:** Can be accessed by multiple tenants with appropriate scoping
- **Audit Isolation:** Each tenant's audit log separately accessible

#### Performance at Enterprise Scale
- **Agent Count:** 100s to 1000s of agents
- **Request Rate:** 1000s of requests per second
- **Caching Strategy:**
  - Policy cache (updated periodically)
  - Revocation list cache (eventually consistent, with rapid refresh on incident)
  - Identity cert cache (with periodic refresh)
- **Measurement:** Latency <500ms for 99th percentile at scale

#### Compliance & Regulatory
- **Audit Trail:** Immutable, signed, queryable
- **Data Residency:** Can be configured per tenant
- **Encryption:** In-transit (TLS) and at-rest (customer-managed keys)
- **Access Logs:** Who accessed what, when, why (for regulatory review)
- **Incident Response:** Can replay all actions by agent to assess impact

#### Operational Runbooks
- **Agent Onboarding:** Step-by-step process with checkpoints
- **Agent Offboarding:** Revocation, audit cleanup, credential destruction
- **Incident Response:** Suspend agent, investigate, approve reinstatement
- **Token Refresh:** Scheduled renewal workflows
- **Policy Updates:** Testing, deployment, rollback procedures

#### Cost Model
- **Fixed Costs:** Authority Brain infrastructure
- **Variable Costs:** Per-request verification overhead
- **Optimization:** Caching and batching reduce variable costs
- **ROI:** Reduced security incidents and audit labor

### Key Figures
- Enterprise architecture stack
- Integration points with existing systems
- High-availability deployment
- Policy management workflow
- Multi-tenant scoping

---

## 16. Automotive Applications (4–5 pages)

### Purpose
Detailed exploration of autonomous vehicles as a critical domain for IrisKey.

### Structure

#### The Autonomous Vehicle Challenge
- AV must make real-time safety-critical decisions
- "Prompt injection" = malicious road sign, spoofed GPS, sensor manipulation
- "Memory corruption" = LiDAR data drift, model weight tampering
- Authorization needed: not every sensor reading leads to action
- Example: GPS anomaly detected; still trust GPS? Verify with other sensors first.

#### AV Agent Architecture
- **Main Agent:** Drives vehicle (acceleration, steering, brake decisions)
- **Perception Agent:** Processes sensor data, creates scene understanding
- **Planning Agent:** Determines route, maneuvers
- **Safety Agent:** Independent verification (oversees decisions)
- **Communication Agent:** V2X (vehicle-to-everything), updates

#### Five-Gate Applied to AV Decisions

##### Example: Left Turn Decision
1. **Identity Gate:** Is this a genuine, uncompromised Main Agent?
   - Cryptographic verification of agent software hash
   - Verification of telemetry signature
   - Fail: Don't perform turn; halt or limp-home

2. **Policy Gate:** Is left turn permitted by traffic law + route?
   - Traffic signal state (from trusted sensor fusion)
   - Route planning (does turn align with intended route?)
   - Geofence restrictions (no turns in restricted areas?)
   - Fail: Override with brake; alert safety agent

3. **Action Gate:** Is left turn authorized given vehicle state?
   - Vehicle speed in acceptable range for turning
   - Steering system operational
   - Tire grip predicted sufficient
   - Fail: Reject turn; proceed straight or brake

4. **Context Gate:** Does request context show signs of sensor compromise?
   - Sensor consistency check (all sensors agree on road state?)
   - Behavioral plausibility (does turn make sense for current route?)
   - Anomaly detection (is GPS consistent with visual perception?)
   - Flags: Raised → escalate to human (driver takeover); High → override

5. **Execution Gate:** Can system safely execute turn?
   - Steering actuator responsive
   - Brake function verified
   - Logging/recording systems ready (incident capture)
   - Fail: Request deferred until system ready; driver warned

#### Authorization Domains in AV

| Domain | Scope | Example |
|--------|-------|---------|
| **Locomotion** | Speed range, steering limits, brake authority | Speed 0–120 km/h, steering ±30°, brake 0–1G |
| **Route** | Permitted roads, geo-fences, no-go zones | City roads only, exclude restricted areas |
| **Sensors** | Which sensor data to trust, thresholds | Trust camera + radar; LiDAR anomaly if inconsistent |
| **Communications** | V2X message acceptance, response | Accept traffic light data from city infrastructure; ignore random broadcasts |
| **Manual Override** | Conditions for human driver control | Driver can take over anytime (explicit handoff with logging) |

#### Threat Scenarios & Mitigation

| Threat | Scenario | IrisKey Mitigation |
|--------|----------|---|
| **Sensor Spoofing** | Attacker projects false road sign | Perception Agent detects inconsistency (sign alone vs. GPS + map); Context Gate flags anomaly; request escalated |
| **GPS Jamming** | GPS signal jammed; attacker provides fake data | Sensors misaligned detected; Context Gate anomaly high; turn request rejected; vehicle slows until GPS recovers |
| **Model Corruption** | Main Agent's decision model is tampered with | Boot-time verification of model hash; Verified Memory checks model integrity continuously |
| **Sensor Glitch** | Sudden sensor failure (camera going blind) | Multimodal sensor fusion; other modalities compensate; Execution Gate detects degraded state; restrict max speed |
| **Takeover Attack** | Attacker gains direct control of steering | Dual systems: steering command goes through Authority Brain verification; hardware failsafe (steering column lock if verification fails) |

#### Safety-Critical Properties

##### Determinism
- Every decision has deterministic audit trail
- Can replay incident: "Why did AV turn left at that moment?" → Full Five-Gate log
- Accountability: no hidden decision paths

##### Fail-Safe
- When in doubt, brake
- If Authority Brain unavailable: default to restrictive policy
- Timeouts trigger fail-safe (vehicle stops)

##### Human Authority
- Human driver can always override (explicit handoff)
- Override is logged (for analysis + legal liability)
- Handoff validates driver is attentive (takeover confirmation)

##### Continuous Verification
- Not just "verify once at startup"
- Every significant decision re-verified
- Sensor drift detected and corrected in real-time

#### Real-World Scenario: Intersection at Rush Hour

```
T0: AV approaches busy intersection
  - Main Agent proposes: "Turn left"
  - Identity Gate: Agent verified ✓
  - Policy Gate: Traffic light green for left turn ✓
  - Action Gate: Speed OK, steering responsive ✓
  - Context Gate: All sensors consistent, behavior normal ✓
  - Execution Gate: Actuators ready ✓
  → Decision: APPROVE
  → Steering input sent; turn executed

T0+50ms: Pedestrian enters intersection (human error)
  - Perception Agent detects pedestrian (high confidence)
  - Main Agent: "Need to brake"
  - Already mid-turn, but braking takes precedence
  - All Gates verify emergency braking ✓
  → Decision: APPROVE
  → Brake engaged; turn aborted (vehicle regains straight trajectory)

T0+200ms: Post-incident
  - AV has stopped safely
  - Audit log shows:
    - Pedestrian detection
    - Brake decision authorization
    - Execution timeline
  - Accessible for accident investigation
  - Insurance review: AV behavior was correct (pedestrian error)
```

#### Regulatory & Standards Alignment
- **ISO 26262** (Functional Safety for vehicles): IrisKey provides deterministic audit trail + revocation
- **ISO 21448** (Safety of Intended Functionality): IrisKey limits autonomous decisions to authorized scopes
- **SAE Automation Levels:** IrisKey applicable to SAE Level 3–5
- **SOTIF** (Safety of Intended Functionality): IrisKey helps ensure intended behavior

### Key Figures
- AV agent architecture
- Five-Gate applied to critical AV decisions
- Multi-sensor fusion with IrisKey verification
- AV threat scenarios and mitigation
- Intersection decision timeline

---

## 17. Defence & NATO Applications (4–5 pages)

### Purpose
Explore autonomous military systems and NATO-aligned governance requirements.

### Structure

#### Defence Challenge
- Autonomous weapon systems, logistics, cyber defence
- Must operate in adversarial environment
- Lives depend on correct decision-making
- Doctrine requires verification (Rules of Engagement compliance)
- NATO allies must have assurance of control

#### Types of Defence Agents

##### Tactical Agents
- Autonomous vehicles (unmanned ground, aerial, maritime)
- Sensor fusion for threat detection
- Weapon targeting and engagement
- Must comply with Rules of Engagement (ROE)

##### Logistics Agents
- Supply chain optimization
- Autonomous transportation
- Resource allocation
- Lower risk but scale and impact large

##### Cyber Agents
- Automated threat detection and response
- Intrusion countermeasures
- Network defense
- Must distinguish: authorized vs. unauthorized traffic

##### Intelligence Agents
- Data analysis and fusion
- Pattern detection
- Threat assessment
- High-value information (secrecy critical)

#### Rules of Engagement (ROE) & Authority
- ROE are formal military rules determining when force is authorized
- Traditional: humans enforce ROE through training and oversight
- Challenge: Autonomous systems need deterministic ROE encoding
- IrisKey approach: ROE embedded in Policy Gate + Context Gate

#### Encoding ROE in IrisKey

##### Example: Autonomous Air Defense System
```
ROE: "Engage only if:
  1. Threat is positively identified as hostile
  2. Threat is outside friendly airspace perimeter
  3. Engagement approved by Air Operations Center (AOC)
  4. Friendly assets not at risk from engagement"
```

**Encoding in IrisKey:**
- **Policy Gate:** 
  - Policy stored: "Engage action only if threat_confidence > 0.95"
  - Policy checks: "perimeter_check == hostile_outside"
  - Policy requirement: "AOC_approval_token present and valid"

- **Context Gate:**
  - Behavioral anomaly if engagement rate spikes (possible target lock loop)
  - Cross-validation: radar + infrared agreement on threat ID
  - Anomaly if AOC approval obtained outside normal hierarchy

- **Execution Gate:**
  - Weapon system operational check
  - Engagement envelope (engagement is feasible)
  - Audio/visual crew confirmation (human-in-loop if policy requires)

#### NATO Interoperability
- **Multi-National Agents:** Coalition members deploy agents
- **Trust Anchors:** NATO certifies authority for certain actions
- **Delegation Chains:** US agent can delegate to allied agent with NATO approval
- **Incident Investigation:** NATO can audit entire action chain
- **Collective Defense:** Article 5 implications require trustworthy agents

#### Classified Information & IrisKey
- **Clearance Levels:** IrisKey integrates with NATO/national classification
- **Need-to-Know:** Authority scoped by classification level + need-to-know
- **Secure Audit Trail:** Classified audit logs (access restricted)
- **Segregation:** Agents operate at specific classification level only

#### Threat Model for Defence

| Threat | Definition | Military Impact | IrisKey Mitigation |
|--------|-----------|---|---|
| **Adversary Compromise** | Enemy gains access to agent system | Rogue autonomous actions | Identity verification + behavioral monitoring catches impersonation |
| **Supply Chain Sabotage** | Hardware/software tampered before deployment | Agent is unwitting spy/saboteur | Boot-time verification of all components; Verified Memory detects drift |
| **Insider Threat** | Authorized military personnel betray | Intentional misuse of agent authority | Audit trail provides forensic evidence; patterns flagged by anomaly detection |
| **Spoofed Comms** | Adversary spoofs friendly orders | Agent takes unauthorized action | Cryptographic authentication of all comms; Context Gate validates order source |
| **Sensor Deception** | Adversary manipulates sensor data | Misidentification of threat/friendly | Multi-sensor fusion; anomaly if sensors conflict |

#### Command & Control Integration
- Traditional C&C: Human command authority chain
- Autonomous C&C: Agent authority delegation chain
- Hybrid: Humans command; agents execute with verification
- IrisKey provides: Verifiable command authority flow

#### Example: Naval Task Force Scenario
```
Admiral (human) orders: "Defend against detected threat"
  ↓
Fleet Coordination Agent (autonomous)
  - Verifies: Admiral's command authority ✓
  - Analyzes: Threat intelligence + positioning
  - Decides: Assign two ships for interception
  - Five Gates: All pass ✓
  ↓
Ship Agent #1 (Ship A – destroyer)
  - Receives delegation: "Intercept threat in zone X"
  - Verifies: Authority scope (zone X is in my patrol area) ✓
  - Decides: Recommend non-lethal challenge first
  - Five Gates: All pass ✓
  ↓
Weapon System Agent (on Ship A)
  - Receives order: "Man stations; prepare weapons"
  - (No engagement order yet; just preparation)
  - Five Gates: All pass ✓
  ↓
Threat develops: Hostile intent clear
  - Ship Agent proposes: "Engage target"
  - But Context Gate detects: ROE compliance uncertain
  - Escalates to Ship Captain (human)
  ↓
Captain (human) confirms: "Engage per ROE"
  - Authority confirmed; Weapon System Agent receives approval
  - Five Gates: All pass (with human-in-loop confirmation)
  - Weapon engagement executed ✓
  ↓
Audit Trail: Complete action chain with human decision points logged
```

#### NATO Certification & Assurance
- **Agent Certification:** NATO certifies agent meets required standards
- **Audit Trail Retention:** Incident review requires stored audit trails
- **Cross-Border Operations:** Agents must prove compliance to allied command
- **Incident Investigation:** If agent decision is questioned, full audit trail available

#### Quantum Threat to Defence Agents
- Adversaries with quantum computers could:
  - Forge digital signatures (impersonate agents)
  - Break encryption (spy on classified orders)
- IrisKey roadmap: quantum-resistant cryptography
- Defence: Adopt post-quantum algorithms before threat is live

### Key Figures
- Defence agent architecture and hierarchy
- Rules of Engagement encoding in IrisKey
- NATO multi-national trust architecture
- Naval task force decision flow
- Threat-to-mitigation matrix for defence

---

## 18. Government Digital Identity (4–5 pages)

### Purpose
Apply IrisKey to national digital identity systems (e-government, citizen services).

### Structure

#### Government Digital Identity Challenge
- Citizens need secure digital identity for government services
- Fraud risk: impersonation, credential theft, identity spoofing
- Scale: millions of citizens, dozens of agencies
- Traditional solution: centralized identity database (single point of failure)
- IrisKey approach: Distributed, verifiable identity with continuous authorization

#### eGovernment Service Scenario
```
Citizen Alice wants to: Apply for passport renewal online

Traditional flow:
  1. Alice logs into portal (username/password)
  2. Portal verifies username/password
  3. Portal grants session access
  4. Alice submits application
  5. Portal records and submits to Passport Office

Risks:
  - Password compromise → full access
  - Session hijacking → false application
  - Portal breach → mass identity theft
```

```
IrisKey-enhanced flow:
  1. Alice authenticates to identity provider (gov digital ID)
  2. Identity provider issues agent token tied to Alice's identity
  3. Alice's agent (on her device) uses token to request passport application
  4. Five-Gate Authority verification:
     - Identity Gate: Is this Alice's genuine token? ✓
     - Policy Gate: Is Alice authorized to renew passport? (age, location, etc.) ✓
     - Action Gate: Passport renewal action within scope? ✓
     - Context Gate: Request from Alice's home IP? ✓
     - Execution Gate: Passport service ready? ✓
  5. Application submitted with signed audit trail
  6. Passport office can verify: "This definitely came from Alice"

Improvements:
  - Compromise of single Alice session doesn't affect other citizens
  - Audit trail is cryptographically signed (non-repudiation)
  - Revocation is immediate if compromised
  - Fraud detection: abnormal request patterns trigger review
```

#### Multi-Agency Integration
- Citizens interact with many agencies (Tax, Social Services, Health, etc.)
- Each agency trusts a common identity provider
- IrisKey enables: Citizen agent can act on behalf of citizen across agencies

#### Identity Lifecycle

##### Registration
- Citizen registers with government digital ID provider
- In-person or remote verification (depends on assurance level)
- Citizen identity pinned to cryptographic key
- Certificate issued (signing credentials)

##### Verification
- When citizen makes request to any government service
- Service verifies citizen's identity via certificate chain
- Continuous verification: every request re-verified
- Behavioral anomaly detection (is this normal for this citizen?)

##### Suspension/Revocation
- Credential compromise detected → suspend
- Citizen reports lost phone/key → revoke
- Legal sanction (court order) → revoke
- Natural expiry → automatically expires certificate

##### Recovery
- Citizen re-authenticates with government ID provider
- New credentials issued
- Old credentials moved to revocation list
- Recovery is slow (security purposeful) vs. fast recovery from backup

#### Trust Model
- **Trust Anchor:** Government Digital Identity provider (e.g., UK GOV.UK Verify)
- **Delegation:** Citizens delegate to "agents" (devices, services)
- **Services:** Government agencies trust identity provider; verify accordingly
- **Interoperability:** Services from different countries can recognize each other's identity providers (international trust federation)

#### Privacy in Government Digital Identity

##### Privacy-Preserving Authorization
- Service doesn't need to know: "Who is Alice?"
- Service only needs: "Is this request from a valid government ID holder with permission for action X?"
- Selective disclosure: reveal only necessary attributes
  - Example: Passport renewal doesn't need to disclose tax status
  - Tax return doesn't need to disclose health records

##### Attribute-Based Authorization
- Instead of: "This is citizen ID #12345678"
- Use: "This request is from a verified adult in the UK with current address in Manchester"
- Authority is granted based on attributes, not identity
- Privacy: Citizens control what attributes are revealed

#### Real-World Scenario: Tax Filing

```
1. Citizen logs into tax agency portal with gov digital ID
   → Identity verified ✓
   → Continuous verification triggered (ongoing throughout session)

2. System queries: "Pull citizen's tax records from prior years"
   → Request goes through Five-Gate verification
   → Execution Gate confirms: "Tax agency has authority to access citizen's tax history"
   ✓ Request approved

3. Citizen submits tax return
   → System computes tax liability
   → Submission goes through Five-Gate verification
   → Context Gate checks: "Is this submission pattern normal?" (yes, annual)
   → Execution Gate confirms: "Tax agency ready to receive submission"
   ✓ Request approved

4. Submission recorded with cryptographic signature
   → Audit trail includes: citizen identity + timestamp + tax agency + amount + signature
   → Citizen can download receipt with proof of submission

5. Six months later: Tax audit
   → System retrieves original submission + audit trail
   → Verifies signature (no tampering)
   → Verifies submission was authorized (citizen identity + policy at time)
   → Provides non-repudiation: citizen submitted this; cannot later claim didn't

6. If dispute arises:
   → Full audit trail available
   → Can replay: "What was citizen's identity at submission time?"
   → Can verify: "Was policy satisfied?"
   → Resolves disputes with cryptographic proof
```

#### Integration with National eID Systems
- IrisKey complements eID cards (e.g., German nPA, Estonian eID)
- eID card provides: Cryptographic identity (on-card key storage)
- IrisKey adds: Continuous verification, authorization scoping, revocation
- Together: eID card + IrisKey = secure government digital identity ecosystem

#### Cross-Border eGovernment
- Citizens of one country accessing services of another
- Requires trust between national identity providers
- IrisKey enables: Citizen's country can vouch for identity to service's country
- Mutual recognition: Both countries' identity providers trust each other

#### Regulatory & Compliance
- **GDPR:** Privacy controls built into IrisKey (selective disclosure)
- **eIDAS Regulation:** Digital identity for transactions within EU
- **UK Services:** Post-Brexit, UK has own digital identity framework (aligned with NIST)
- **Liability:** Government can prove citizen authorized action (audit trail)

### Key Figures
- Government digital identity architecture
- Multi-agency service access
- Tax filing workflow with IrisKey
- Privacy-preserving attribute disclosure
- Trust federation (domestic + cross-border)

---

## 19. Healthcare (3–4 pages)

### Purpose
Healthcare systems with autonomous agents for diagnosis, prescriptions, research.

### Structure

#### Healthcare Challenge
- Patient safety is paramount (errors can be fatal)
- Multiple stakeholders: doctors, nurses, pharmacists, researchers, patients
- Data sensitivity: health information is highly regulated (HIPAA, GDPR)
- Real-time decisions: urgent cases require fast authorization

#### Healthcare Agents

##### Diagnostic Agent
- Analyzes patient symptoms and history
- Recommends diagnoses (with confidence scores)
- Must not over-rely on pattern matching
- Physician must verify before acting

##### Treatment Planning Agent
- Recommends treatment given diagnosis
- Considers patient allergies, drug interactions
- Must verify: "Is recommended treatment safe for this patient?"

##### Prescription Authorization Agent
- Verifies prescription is appropriate
- Checks: Dose is safe, drug is indicated, no contraindications
- Pharmacist must verify before dispensing
- Patient safety critical

##### Research Data Agent
- Analyzes patient populations for research
- Must maintain patient privacy
- Can only access consented data
- Audit trail required for research integrity

#### Five-Gate Applied to Diagnosis

```
Patient presents with chest pain; Diagnostic Agent runs

1. Identity Gate
   - Is this a genuine, uncompromised Diagnostic Agent? ✓
   - Has it been trained on validated medical data? ✓
   
2. Policy Gate
   - Is diagnostic recommendation permitted for this patient type? ✓
   - Does patient consent to AI-assisted diagnosis? ✓
   - Are medical staff available to verify? ✓

3. Action Gate
   - Recommended diagnosis is within agent's scope? ✓
   - Does recommendation require urgent physician action? (maybe escalate)
   - Is follow-up testing in scope?

4. Context Gate
   - Is diagnosis recommendation consistent with:
     - Patient symptoms? ✓
     - Patient history? ✓
     - Medical literature consensus? ✓
   - Any anomalies in reasoning?

5. Execution Gate
   - Can physician review recommendation within acceptable time? ✓
   - Is clinical team available for urgent action if needed?
   - Notification system ready?

→ Diagnosis recommendation generated + physician notified
→ Physician reviews (human-in-loop requirement)
→ Physician approves or adjusts
→ Treatment plan proceeds
```

#### Multi-Specialist Coordination
- Patient case involves: Cardiologist, Radiologist, Pharmacist, Surgeon
- Each specialist has agent that contributes
- How do their recommendations interact?

**IrisKey Solution:**
- Each specialist's agent independently authorized
- Agents can't override each other (no escalation of privilege)
- Patient record is single source of truth (verified for integrity)
- Conflict resolution: if specialists disagree, escalated to senior physician or ethics committee

#### Privacy in Healthcare

##### Data Minimization
- Agent only accesses data needed for its task
- Diagnostic Agent doesn't need patient's entire life history
- Researcher Agent can't access individual patient names
- Authority scopes data access by role and task

##### Consent Tracking
- Patient consents to: "AI-assisted diagnosis for this visit"
- Audit trail records: When consent obtained, scope, duration
- If patient revokes consent: Agent can't access more data (revocation takes effect)
- Audit: Can reconstruct "What data did AI access without consent?" (if audit happens)

##### Anonymization with Verification
- Research data is anonymized before agent access
- But data integrity still verified (hash chain)
- If anonymization is broken (re-identification possible), audit trail shows:
  - When anonymization was applied
  - Which agent accessed which records
  - What inferences were made

#### Patient Safety & Error Mitigation

##### Mandatory Human Verification
- Critical decisions require physician review:
  - Diagnosis
  - Prescription
  - Surgery recommendation
- Agent supports physician; doesn't replace
- Audit trail records: physician's review and decision

##### Dosing Safety
- Pharmacogenomics agent recommends: "Patient has CYP2C19 variant; reduce dose of clopidogrel"
- Prescription agent verifies: "Patient weight 80kg, liver function normal, no contraindications"
- Pharmacist reviews and approves
- IrisKey enforcement: Each step verified; any discrepancy flagged

##### Adverse Event Detection
- Continuous monitoring: Has patient experienced side effects?
- If side effects detected:
  - Prescribing agent's authority may be scoped differently (fewer doses? shorter duration?)
  - Patient notified automatically
  - Physician alerted
  - Audit trail: Shows detection and response

#### Research Ethics & Compliance

##### IRB Approval Integration
- Institutional Review Board (IRB) approves research protocol
- Protocol encoded in policy
- Research data agent can only act within IRB-approved scope
- Audit: Full trail of who accessed what data for which study

##### Consent Withdrawal
- Patient withdraws consent from study
- Revocation: Research agent can no longer access patient's data
- Cleanup: Data already accessed for study results remains (can't un-analyze)
- Audit: Shows when withdrawal occurred and affected which records

##### Data Retention
- Study ends; data retention period expires
- Authority for agent to access study data expires
- Data deletion is authorized only after retention period
- Audit: Shows data was deleted (or securely destroyed)

#### Telehealth & Remote Patients
- Patient at home; Physician remote
- Monitoring agent tracks patient vitals
- If abnormality detected: Agent alerts physician + patient
- Physician can remotely adjust monitoring parameters (authorization verified)
- All changes logged; patient can review audit trail

### Key Figures
- Healthcare multi-specialist system architecture
- Five-Gate applied to diagnostic recommendation
- Consent lifecycle and revocation
- Research data flow with privacy controls

---

## 20. Banking (3–4 pages)

### Purpose
Financial services and autonomous transaction authorization.

### Structure

#### Banking Challenge
- Financial risk: unauthorized transactions cause direct financial loss
- Regulatory scrutiny: PSD2 (Europe), OCC (US), regulations mandate strong authentication
- Scale: billions of transactions daily
- Speed: Fraud must be caught in milliseconds

#### Banking Agents

##### Transaction Authorization Agent
- Evaluates: "Should this transaction be approved?"
- Checks: Sufficient funds, no fraud indicators, within customer limits
- Must authorize in <100ms (payment network requirement)

##### Fraud Detection Agent
- Monitors transaction patterns
- Detects: Unusual transaction amounts, new recipient, unusual location/time
- Flags: Suspicious transactions for review

##### Lending Agent
- Evaluates loan applications
- Computes credit score, assesses collateral
- Recommends approval/denial with reasoning

##### AML Agent
- Anti-Money Laundering compliance
- Checks: Transaction doesn't match sanctioned parties
- Monitors: Pattern consistency with known risks

#### Five-Gate Applied to Large Transaction

```
Customer requests: Transfer £50,000 to new beneficiary

1. Identity Gate
   - Is request from genuine customer? (biometric, 2FA) ✓
   - Has customer authorized this channel? (app, online, phone) ✓

2. Policy Gate
   - Is customer authorized for large transactions? (account tier, profile) ✓
   - Transfer to new beneficiary: Policy requires additional verification ✓
   - Transfer amount within daily limit? (£50k within typical limit) ✓

3. Action Gate
   - Transfer amount within authorization level? ✓
   - Beneficiary account valid? ✓
   - Account not frozen or restricted? ✓

4. Context Gate
   - Transaction context normal?
     - Time of day: 2pm (normal for this customer) ✓
     - Device: Customer's home IP (usual device) ✓
     - Frequency: First time to this beneficiary (attention) ⚠️
   - Fraud score: Low risk (customer's own bank account) ✓

5. Execution Gate
   - Payment network operational? ✓
   - Bank's risk systems ready? ✓
   - Audit trail systems functioning? ✓

→ Decision: ESCALATE to phone verification (policy for new beneficiary)
→ Customer confirms identity via phone + code sent to registered mobile
→ Verification complete
→ Transaction approved
```

#### Regulatory Compliance

##### PSD2 (Payment Services Directive 2)
- Strong authentication required (multiple factors)
- IrisKey integrates with 2FA/MFA
- Provides audit trail (PSD2 requires proof of transaction authorization)
- Liability protection: "Was transaction authorized?" → Audit trail proves yes

##### Know Your Customer (KYC)
- Agent must "know" customer:
  - Identity verified
  - Source of funds confirmed
  - Business purpose understood (for business accounts)
- IrisKey proves: Customer verified before authorization

##### AML Screening
- Transactions checked against sanctioned party lists
- IrisKey ensures: Every significant transaction screened before approval
- Audit trail: Shows when screening occurred and result

#### Fraud Prevention

##### Real-Time Fraud Detection
- Transaction comes in
- Fraud agent scores risk in real-time (<50ms)
- If high risk: Escalate to manual review
- If low risk: Approve (subject to other gates)

##### Velocity Checks
- "Customer normally makes 2–3 transactions/day; suddenly 15 in 5 minutes"
- Anomaly detected
- Decision: Pause new transactions; alert customer

##### Device Fingerprinting
- Customer's phone has registered device fingerprint
- Transaction from unregistered device → Context Gate anomaly
- May require additional verification before approval

#### Customer Experience vs. Security

**Challenge:** Security (verification) vs. customer convenience (fast approvals)

**IrisKey Approach:**
- Batch verification: Most transactions fast-tracked (low risk)
- Risk-based authentication: High-risk transactions require more verification
- Continuous verification: Background monitoring detects account compromise

**Example:**
- Low-risk transaction (£10 coffee): Approved immediately
- Medium-risk transaction (£500 new merchant): Quick verification (are you sure?)
- High-risk transaction (£10,000 new country): Full verification (multi-factor auth)

#### Cross-Border Payments
- International payment regulations (SWIFT, correspondent banking)
- Each jurisdiction has its own rules
- IrisKey multi-gate approach: Each jurisdiction's rules encoded in separate Gate
- Authorization: Must pass gates for both originating and receiving jurisdiction

#### Lending Use Case

```
Customer applies for £25,000 loan for home improvement

1. Lending Agent analyzes:
   - Credit score: 750 (good) ✓
   - Debt-to-income ratio: 30% (acceptable) ✓
   - Collateral (home equity): Sufficient ✓
   - Purpose: Home improvement (low-risk use) ✓

2. Five-Gate Authorization:
   - Identity Gate: Customer verified ✓
   - Policy Gate: Loan terms within bank's policy ✓
   - Action Gate: Loan amount within customer's tier ✓
   - Context Gate: Application pattern normal? ✓ (first loan app in 2 years)
   - Execution Gate: Funds available? ✓

3. Decision: APPROVE
   → Loan offer generated
   → Terms presented to customer
   → Customer accepts
   → Funds disbursed
   → Audit trail: Shows decision path and reasoning

4. Future: If customer defaults
   → Bank can demonstrate: "Loan was approved per policy and customer circumstances"
   → Audit trail supports compliance defense
```

#### Open Banking & Third-Party Access
- PSD2 enables fintech partners to access customer data (with consent)
- Third-party agents need authorization
- IrisKey provides: Granular authority scoping
  - Third-party app can access: "Account balance, transaction history"
  - Third-party app cannot access: "Passwords, customer contact info, other accounts"
- Audit trail: Shows all third-party accesses

### Key Figures
- Banking agent architecture and decision hierarchy
- Five-Gate applied to large transaction
- Regulatory framework integration (PSD2, AML, KYC)
- Fraud detection and risk scoring workflow
- Customer experience vs. security tradeoff

---

## 21. Critical National Infrastructure (3–4 pages)

### Purpose
Autonomous systems governing power grids, water, comms, supply chains.

### Structure

#### CNI Challenge
- Disruption threatens national security, public health, economic stability
- Systems are increasingly computerized and interconnected
- Autonomous optimization is valuable (efficiency, reliability)
- But: Mistakes or compromises can cascade widely

#### CNI Agents

##### Power Grid Operator
- Balances supply/demand in real-time
- Optimizes frequency, voltage
- Manages distributed renewable generation
- Must prevent blackouts and cascading failures

##### Water Treatment Agent
- Monitors water quality
- Adjusts treatment parameters
- Detects contamination
- Protects public health

##### Communications Network Agent
- Manages routing and failover
- Prioritizes critical traffic (emergency services, healthcare)
- Detects and mitigates DDoS/cyberattacks
- Maintains resilience

##### Supply Chain Agent
- Optimizes logistics and inventory
- Reroutes around disruptions
- Predicts shortages and surpluses
- Coordinates with external suppliers

#### Five-Gate Applied to Power Grid Decision

```
Renewable generation (wind, solar) drops suddenly; demand surge expected

Power Grid Operator Agent proposes:
- "Switch load to natural gas generators"
- "Shed non-critical load in sector D"
- "Import power from neighboring grid"

1. Identity Gate
   - Is this the genuine Power Grid Operator Agent? ✓
   - (SCADA systems verified against known-good configuration)

2. Policy Gate
   - Is load shedding permitted during peak hours? (yes, emergency protocol) ✓
   - Is neighboring grid authorized to import from? ✓
   - Will action comply with environmental regulations? (check stack limits) ✓

3. Action Gate
   - Proposed shedding affects only non-critical sectors? ✓
   - Gas generators have spare capacity? ✓
   - Cross-grid power transfer within technical limits? ✓

4. Context Gate
   - Is this power deficit pattern consistent with weather forecast? ✓
   - Demand surge expected per prediction models? ✓
   - Are other substations showing similar patterns? ✓
   - Any signs of cyberattack (artificial demand spike)? (check) ✓

5. Execution Gate
   - Gas generators responsive and ready? ✓
   - Load shedding commands will complete within safe time window? ✓
   - Monitoring and rollback capability available?
   - Can we detect if shedding goes wrong and restore? ✓

→ Decision: APPROVE with monitoring
→ Actions taken:
   - Renewable generation shift recorded
   - Load shedding executed (sector D, non-critical services)
   - Gas generation increased
   - Cross-grid import initiated
   - Audit trail: Complete action log with timestamps
```

#### Resilience & Cascading Failures

##### Single Point of Failure Risk
- If agent is compromised, it could:
  - Shut down entire sector (blackout)
  - Degrade water treatment (public health risk)
  - Interrupt communications (emergency services down)

##### IrisKey Resilience Strategy
1. **Verification:** Every significant action verified (five gates)
2. **Diversity:** Multiple independent monitoring systems
3. **Reversibility:** Actions designed to be reversible (rollback capability)
4. **Escalation:** Critical decisions escalated to human authority
5. **Audit Trail:** Full history enables post-incident analysis and recovery

##### Human Authority Chain
- Routine operations: Agent autonomous (continuous verification)
- Unusual conditions: Agent can act but escalates immediately
- Emergency: Agent may act but human approval needed within SLA
- Catastrophic risk: Human authority required before action

#### Cyberattack Resilience

**Scenario: Attacker compromises agent via supply chain**

```
Attacker goal: Shut down power to sector (political attack)

Without IrisKey:
  - Compromised agent sends: "Shutdown sector A"
  - No verification; action proceeds
  - Blackout cascade; emergency response delayed
  - No clear evidence of what happened (no trusted audit trail)

With IrisKey:
  - Compromised agent sends: "Shutdown sector A"
  - Identity Gate: Agent certificate OK (compromise not detected at this level)
  - Policy Gate: Shutdown not authorized outside emergency protocols ✗
  - Action rejected; escalation triggered
  - Human authority reviews: "Why shutdown request?"
  - Grid operators investigate
  - Anomaly detected; agent quarantined
  - Audit trail shows: Request, rejection, investigation
  - Incident contained; sector remains online
```

#### Recovery & Resilience
- **Seconds (Immediate):** Automated failover to backup systems
- **Minutes (Acute):** Human operators take manual control
- **Hours (Recovery):** Investigate cause; restore normal operations
- **Days (Post-incident):** Audit trail reviewed; patches deployed; confidence restored

#### Interdependent Systems
- Power grid depends on water (cooling nuclear plants)
- Water treatment depends on power (pumps, treatment systems)
- Communications depends on power (cell towers, data centers)
- Supply chains depend on all three (logistics, coordination)

**IrisKey Benefit:** Cross-system agent coordination with verified authority
- Agent A (power grid) can notify Agent B (water treatment) of conditions
- Agent B can request: "Increase pump power allocation"
- Request goes through Five Gates (no privilege escalation)
- Dependency is auditable

#### Regulatory & Standards

##### NERC CIP (Power Sector)
- North American Electric Reliability Corporation standards
- IrisKey provides: Compliance evidence (audit trails, authorization logs)
- NERC CIP requires: Evidence of authorized system changes

##### ICS/SCADA Security
- Critical infrastructure often uses older SCADA systems
- IrisKey can sit "above" SCADA as governance layer
- Modern agents query SCADA (verified authorization)
- Legacy systems protected; modernization path clear

### Key Figures
- Power grid agent architecture
- Five-Gate applied to load shedding
- Cascading failure prevention model
- Cross-infrastructure agent coordination

---

## 22. Quantum-Resistant Identity (3–4 pages)

### Purpose
Prepare IrisKey for cryptographic threat from quantum computers.

### Structure

#### Quantum Threat to Cryptography

##### RSA & ECDSA Vulnerability
- Current standard: RSA (2048–4096-bit keys), ECDSA
- Threat: Quantum computers (Shor's algorithm) can factor large numbers
- If realized: Current digital signatures become forgeable
- Timeline: Uncertain; estimates 10–20 years or sooner

##### IrisKey Vulnerability
- Identity verification relies on digital signatures
- Authority tokens are signed
- Audit trail integrity verified via signatures
- If signatures are forged: entire system compromised

#### Post-Quantum Cryptography

##### NIST Post-Quantum Standardization
- NIST selected post-quantum algorithms (2022 draft)
- Categories:
  - **Lattice-based:** Crystals-Kyber (encryption), Crystals-Dilithium (signatures)
  - **Hash-based:** Falcon (signatures)
  - **Multivariate:** Rainbow (signatures, not recommended)
- Transition: Not immediate; gradual migration

##### Algorithm Selection for IrisKey

**Signatures:** Crystals-Dilithium
- Smaller key size (~2.5 KB private key)
- Reasonable signature size (~2.5 KB)
- Fast verification (~1 ms)
- Well-analyzed

**Encryption (if needed):** Crystals-Kyber
- Larger ciphertext than ECDH (~1 KB)
- Acceptable for one-time key establishment
- But IrisKey may not need encryption (focus is on authentication)

#### Migration Strategy

##### Phase 1: Preparation (2026–2027)
- Implement post-quantum algorithms in non-production environments
- Test interoperability with legacy systems
- Identify operational dependencies

##### Phase 2: Hybrid Deployment (2027–2029)
- Deploy dual signatures: traditional + post-quantum
- Agent signature includes both algorithms
- Verification requires both pass
- Backward compatibility: old verifiers still work (with new sigs)

##### Phase 3: Migration (2029–2032)
- Traditional algorithm deprecated
- Post-quantum becomes primary
- Legacy systems phased out

##### Phase 4: Sunset (2032+)
- Traditional algorithm fully deprecated
- Audit trail migrated (re-sign with post-quantum if needed)
- Post-quantum is standard

#### Technical Challenges

##### Key Rotation
- Existing keys signed with old algorithm
- Migration: Re-sign with new algorithm
- Audit trail implications:
  - Old signatures remain (historical)
  - New signatures added (migration proof)
  - Both are verifiable (hybrid verification)

##### Performance Impact
- Post-quantum signatures larger (~2.5 KB vs. 70 bytes for ECDSA)
- Verification slower (~1 ms vs. 0.1 ms)
- Communication overhead: Not negligible at scale
- Optimization: Batch verification, caching

##### Standardization Lag
- NIST standards not final (draft as of 2024)
- Early adopters (defensive) vs. late adopters (efficient)
- IrisKey decision: Prepare for migration; don't force early adoption

#### Cryptographic Agility

**Design Principle:** IrisKey should be algorithm-agnostic

**Implementation:**
```
Token = {
  "algorithm": "EdDSA",  // or future "Dilithium-5"
  "signature": "...",
  // ... other fields
}

Verification = {
  1. Read algorithm from token
  2. Load corresponding verification key
  3. Use algorithm-specific verification function
  4. Result: Valid or Invalid
}
```

**Benefit:** Can upgrade algorithm without changing token format

#### Hybrid Cryptographic Landscape

**Near-term (2025–2030):**
- RSA/ECDSA dominant
- Post-quantum emerging (NIST standards)
- Both used in parallel (where performance permits)

**Long-term (2030+):**
- Post-quantum becomes standard
- RSA/ECDSA deprecated
- Risk from quantum threat managed

#### Roadmap Item
- Q2 2026: Begin post-quantum cryptographic evaluation
- Q4 2026: Implement dual-signature capability (testing)
- 2027–2029: Gradual rollout to production agents
- 2029–2032: Migration and sunset

### Key Figures
- Quantum threat timeline and algorithms
- Cryptographic agility architecture
- Hybrid signature verification workflow
- Migration phasing

---

## 23. Regulatory Alignment (3–4 pages)

### Purpose
Map IrisKey to existing regulatory frameworks.

### Structure

#### Applicable Frameworks

##### NIST AI Risk Management Framework
- Addresses AI governance at policy level
- IrisKey fulfills: Continuous verification, risk monitoring, revocation
- Provides: Technical implementation of NIST principles
- Alignment: Maps to NIST's "GOVERN" and "MAP" functions

##### ISO/IEC 42001 (AI Management Systems)
- Addresses organizational management of AI
- IrisKey supports: Resource management, process controls, monitoring
- Compliance: Audit trail supports conformity assessment

##### ISO/IEC 27001 (Information Security)
- Addresses information security management
- IrisKey supports: Identity verification, access control, audit logging
- Compliance: Continuous monitoring fulfills audit requirements

##### Zero Trust Architecture (NIST SP 800-207)
- Foundational principle: Never trust, always verify
- IrisKey implements: Identity-centric verification, continuous monitoring
- Enhanced for: Autonomous systems (not just users)

##### EU AI Act
- Risk-based approach: High-risk AI systems require governance
- IrisKey supports:
  - High-risk AI: Mandatory human oversight (Authority Brain enables verification)
  - Documentation: Full audit trail for compliance
  - Transparency: Explainable decisions (Five-Gate workflow is auditable)

##### UK AI Bill (Emerging)
- Post-Brexit UK frameworks for AI governance
- IrisKey alignment: Transparency, accountability, risk management

#### Sector-Specific Regulations

##### Financial (PSD2, OCC, FCA)
- Strong authentication: IrisKey provides via continuous verification
- Audit trail: Supports transaction authorization proof
- Liability: Non-repudiation via digital signatures

##### Healthcare (HIPAA, GDPR)
- Access control: IrisKey enforces authorization scopes
- Audit trail: Privacy controls via selective disclosure
- Consent tracking: Revocation enables consent withdrawal

##### Automotive (ISO 26262, SOTIF, SAE)
- Functional safety: IrisKey provides deterministic audit trail
- Safety of intended functionality: Authority scopes prevent misuse
- Levels 3–5: IrisKey supports autonomous decision verification

##### Defence (NATO Standards)
- Classified information: IrisKey integrates with classification levels
- Rules of Engagement: Encoded in policy for Five-Gate verification
- Incident investigation: Audit trail supports legal review

##### Critical Infrastructure (NERC CIP, ICS)
- Operator authorization: IrisKey verifies authority for actions
- Change management: Audit trail documents all system changes
- Incident response: Full evidence chain for investigation

#### Compliance & Audit

##### Documentation
- IrisKey maintains: Policy records, token issuance logs, audit trails
- Compliance officer can: Query any agent's authorization history
- Auditor can: Verify: "Was this action authorized at time of execution?"

##### Traceability
- Every consequential action traced to:
  - Agent identity
  - Authority at time of action
  - Policy that was in effect
  - Decision reasoning (Five-Gate gates passed)
  - Audit trail signature (non-repudiation)

##### Incident Response
- Breach detected; need to investigate: "What did the compromised agent do?"
- IrisKey enables: Full replay of agent's authorized actions
- Assessment: Were any unauthorized actions detected and blocked?
- Remediation: Revoke agent; analyze impact; restore

#### Liability & Insurance

##### Non-Repudiation
- Agent can't later claim: "I didn't do that" (digital signature proves it did)
- Customer can't claim: "I didn't authorize that" (cryptographic authorization proves they did)
- Organization can't claim: "We don't know what happened" (audit trail is complete)

##### Demonstrable Compliance
- Regulator asks: "Were AI systems authorized before consequential actions?"
- Response: "Yes, here is the Five-Gate authorization log for each action"
- Proof: Cryptographically signed, auditable, reproducible

##### Insurance Implications
- Policies may cover: "AI systems with provable authorization governance"
- Policies may exclude: "AI systems without continuous verification"
- IrisKey enables: Insurance coverage and reduced premiums

#### Regulatory Roadmap
- 2025: NIST finalization; early adoption by risk-aware organizations
- 2026–2027: EU AI Act enforcement; organizations update systems
- 2027: ISO/IEC 42001 adoption accelerates
- 2028+: Regulatory harmonization; IrisKey seen as baseline for governance

### Key Figures
- Regulatory framework alignment matrix
- Compliance evidence collection workflow
- Audit trail query and replay capability
- Risk-based governance model

---

## 24. Reference Implementation (4–5 pages)

### Purpose
Provide conceptual architecture for building IrisKey-like systems.

### Structure

#### Implementation Not Production Code
- Goal: Show technical feasibility and architecture
- Not: Production-ready implementation
- Use: Pseudocode, conceptual diagrams, API specifications

#### Component Architecture

##### Identity Component
```
Identity(
  - Agent registration (unique identity creation)
  - Credential issuance (key pair, certificate)
  - Revocation list maintenance
  - Key rotation on schedule/compromise
)
```

**API:**
- `register_agent(name, type, metadata)` → agent_id, private_key
- `verify_signature(agent_id, message, signature)` → bool
- `revoke_agent(agent_id, reason)` → revocation_id

##### Authority Brain Component
```
AuthorityBrain(
  - Policy engine
  - Five-Gate verification logic
  - Token issuance
  - Continuous monitoring
)
```

**API:**
- `verify_authority(agent_id, action, resource, context)` → (approved/rejected, token or reason)
- `revoke_token(token_id, reason)` → void
- `update_policy(policy_id, new_rules)` → void
- `get_anomaly_score(agent_id, timeframe)` → float (0–1)

##### Token Component
```
Token(
  - Token generation (signed claims)
  - Token validation
  - Scope enforcement
  - Revocation check
)
```

**API:**
- `create_token(agent_id, action_scope, resource_scope, conditions, lifetime)` → signed_token
- `validate_token(token)` → (valid/invalid, claims or reason)
- `check_revoked(token_id)` → bool

##### Memory Component
```
Memory(
  - Cryptographic hashing
  - Merkle tree structure
  - Audit trail logging
  - Integrity verification
)
```

**API:**
- `store_record(agent_id, data)` → hash, merkle_proof
- `retrieve_record(agent_id, record_id)` → data, hash, merkle_proof
- `verify_integrity(record_id, hash)` → bool (valid/tampered)
- `get_audit_trail(agent_id, time_range)` → [audit_entries]

##### Monitoring Component
```
Monitoring(
  - Behavioral profiling
  - Anomaly detection
  - Alert generation
  - Trend analysis
)
```

**API:**
- `record_action(agent_id, action, outcome, timestamp)` → void
- `get_anomaly_score(agent_id)` → float
- `detect_drift(agent_id, policy_id)` → [violations]
- `get_alert(alert_id)` → alert_details

#### Integration Architecture

**Simplified flow:**
```
1. Agent requests action
2. AuthorityBrain.verify_authority(...)
   - Identity.verify_signature(...)
   - PolicyEngine.evaluate_policy(...)
   - AnomalyDetection.score_context(...)
   - Token.validate_token(...)
3. If approved: ExecutionEngine.execute(action)
4. Monitoring.record_action(...)
5. Memory.store_record(...)
```

#### Data Structures

##### Agent
```
{
  "agent_id": "agent_<uuid>",
  "name": "Diagnostic Agent",
  "type": "diagnostic",
  "public_key": "...",
  "certificate": "...",
  "created_at": "ISO8601",
  "revocation_status": "active|revoked|suspended",
  "metadata": {
    "domain": "healthcare",
    "model_version": "v3.2",
    "responsible_party": "Dr. Smith"
  }
}
```

##### Authority Token
```
{
  "token_id": "token_<uuid>",
  "agent_id": "agent_<uuid>",
  "action_scope": ["read:documents", "write:drafts"],
  "resource_scope": ["org:acme"],
  "conditions": {...},
  "issued_at": "ISO8601",
  "expires_at": "ISO8601",
  "signature": "...",
  "revocation_status": "valid|revoked|expired"
}
```

##### Audit Entry
```
{
  "entry_id": "audit_<uuid>",
  "timestamp": "ISO8601",
  "agent_id": "agent_<uuid>",
  "action": "read:document",
  "resource": "doc_12345",
  "decision": "approved|rejected",
  "reason": "All gates passed|Policy violation at Gate 2",
  "gates_passed": [true, true, true, true, true],
  "anomaly_score": 0.15,
  "signature": "...",
  "previous_entry_hash": "..."  // Chain integrity
}
```

#### Deployment Topologies

##### Single-Region Deployment
- One Authority Brain instance
- Simple; lowest latency
- Risk: Single point of failure

##### Multi-Region (Active-Active)
- Multiple Authority Brain instances
- Token verification decentralized
- Revocation list sync: quorum-based or eventual-consistent
- Trade-off: Consistency window vs. availability

##### Federated (Multi-Organization)
- Each organization runs own Authority Brain
- Trust anchors for cross-organization delegation
- Delegation tokens cross organizational boundaries
- Audit trail includes organization context

#### Performance Characteristics

| Component | Operation | Latency |
|-----------|-----------|---------|
| Identity | Signature verification | ~1 ms |
| Authority Brain | Five-Gate verification | ~100–500 ms |
| Token | Token validation | ~10–100 µs |
| Memory | Hash verification | ~100 µs |
| Monitoring | Anomaly score | ~50–200 ms |
| **Total** | **Authorization request** | **~150–800 ms** |

#### Testing Strategy

**Unit Tests:**
- Identity: Signature verification correctness
- Policy Engine: Rule evaluation correctness
- Token: Scope enforcement
- Memory: Hash chain integrity

**Integration Tests:**
- Five-Gate sequence with simulated requests
- Token lifecycle (issuance → expiry → revocation)
- Audit trail integrity (chain verification)

**Load Tests:**
- 1000s of concurrent authorization requests
- Revocation list sync latency
- Monitoring pipeline under high event volume

**Security Tests:**
- Attempt signature forgery (should fail)
- Attempt scope escalation via token modification (should fail)
- Attempt replay attacks (should fail with timestamp validation)
- Attempt memory tampering (should be detected)

#### Configuration

**Policy Language (simplified):**
```
policy: "diagnostic_recommendation"
  if agent_type == "diagnostic" 
  and patient_consent == true
  and physician_available == true
  then action == "recommend_diagnosis"
  and scope == ["read:patient_history", "read:test_results"]
  and not allow scope ["write:electronic_health_record"]
  and revoke if patient_withdraws_consent
  and revoke if agent_accuracy < 0.90
```

**Conditions Language:**
```
condition: "normal_business_hours"
  hours_of_day: 09:00–17:00
  days_of_week: Mon–Fri
  
condition: "low_volume"
  requests_per_minute: < 100
  
condition: "normal_geography"
  source_location: within_country
```

#### Extensibility
- Plugin architecture for custom policy rules
- Custom anomaly detection algorithms
- Custom memory backends (in-memory, database, distributed)
- Custom notification/escalation systems

### Key Figures
- Component architecture diagram
- Data flow diagram (request → authorization → execution)
- Token lifecycle sequence diagram
- Performance timeline (authorization request path)

---

## 25. Future Research (3–4 pages)

### Purpose
Identify open problems and research directions.

### Structure

#### Formal Verification
**Problem:** How to formally prove IrisKey makes decisions correctly?
- Current: Audit trail verification (retrospective)
- Future: Formal proof of correctness (prospective)
- Research: Apply formal methods to Authority Brain
- Impact: Mathematical certainty about authorization decisions

#### Distributed Authority Brain
**Problem:** How to distribute Authority Brain across organizations while maintaining consistency?
- Current: Single Authority Brain or federated (weak consistency)
- Future: Byzantine-fault-tolerant consensus
- Research: Apply BFT (PBFT, Raft variants) to distributed authorization
- Impact: Decentralized trustworthy governance without central authority

#### Incentive Compatibility
**Problem:** In multi-agent systems, how do we ensure no agent is incentivized to cheat?
- Current: IrisKey assumes agents follow policy
- Future: Game theory analysis of agent behaviors
- Research: Design incentive structures where cheating is irrational
- Impact: Intrinsic trustworthiness via economic incentives

#### Explainability & Interpretability
**Problem:** Why did IrisKey reject/approve a specific request? (Especially for Context Gate anomalies)
- Current: Logs show what happened; not always why
- Future: Explainable AI for anomaly scoring
- Research: Make context gate decisions interpretable to operators
- Impact: Trust in Authority Brain; easier debugging of false positives

#### Threat Evolution
**Problem:** New attacks will emerge; how does IrisKey adapt?
- Current: Policy updates (slow); revocation (reactive)
- Future: Automated threat detection and policy adaptation
- Research: Machine learning for threat pattern recognition
- Impact: Proactive rather than reactive security

#### Quantum-Resistant Protocols
**Problem:** Current cryptography vulnerable to quantum computers
- Current: RSA/ECDSA (quantum-vulnerable)
- Future: Post-quantum algorithms
- Research: Optimize post-quantum crypto for IrisKey's performance requirements
- Impact: Long-term security (20+ years)

#### Autonomous Verification
**Problem:** Can IrisKey verify itself? (Reflexive trust)
- Current: IrisKey trusted by assumption
- Future: IrisKey verifies its own integrity
- Research: Self-checking systems; integrity proofs
- Impact: Detection of Authority Brain compromise

#### Privacy-Preserving Verification
**Problem:** Can we verify authorization without revealing sensitive context?
- Current: Full context available to Authority Brain
- Future: Zero-knowledge proofs of authorization
- Research: Cryptographic protocols for context verification without disclosure
- Impact: Enhanced privacy; agent context remains confidential

#### Temporal Logic & Time-Bounded Authority
**Problem:** Current authority tokens are temporally scoped; can we do better?
- Current: Token valid from X to Y
- Future: Temporal logic formulas: "Authorized until condition Z occurs"
- Research: Formal temporal logic for authorization
- Impact: More nuanced authorization (conditional on events, not just time)

#### Human-AI Teaming
**Problem:** How do IrisKey-governed agents interact with humans optimally?
- Current: Humans and agents parallel (agents do one thing, humans do another)
- Future: Seamless human-AI collaboration with verified authority
- Research: Authority models that blend human expertise with AI capability
- Impact: Better decision-making through human-AI partnership

#### Scalability to Extreme Scale
**Problem:** Can IrisKey scale to trillions of micro-agents?
- Current: Designed for 100s–1000s of agents
- Future: Hierarchical governance; distributed decision-making
- Research: Scalable verification without centralized bottleneck
- Impact: Swarm robotics; planetary-scale systems

#### Cross-Domain Governance
**Problem:** Agents from different domains (healthcare, finance, defence) interacting; who governs?
- Current: Each domain has own policies
- Future: Meta-policies for cross-domain authority
- Research: Multi-level governance; authority delegation across domains
- Impact: Complex systems requiring multi-domain coordination

---

## 26. Conclusion (2–3 pages)

### Purpose
Synthesize the argument and restate the central thesis.

### Structure

#### The Central Question
- "How can autonomous AI systems be continuously trusted before every consequential action?"
- Answer: Intelligence alone is insufficient; trust architecture is essential
- Thesis: Identity Before Automation™

#### Key Contributions Restated
1. **Dual-Brain Architecture:** Separates reasoning (capability) from authority (governance)
2. **Five-Gate Authority Engine:** Sequential, deterministic verification framework
3. **Verified Memory Architecture:** Tamper-evident agent knowledge base
4. **Authority Tokens:** Cryptographic, time-bound, condition-based authorization
5. **Continuous Verification:** Ongoing re-authorization, not one-time checks
6. **Deterministic Revocation:** Immediate, irreversible authority withdrawal
7. **Multi-Agent Governance:** Trustworthy cooperation among autonomous systems
8. **Domain-Agnostic Framework:** Applicable to automotive, healthcare, finance, defence, infrastructure

#### Why This Matters Now
- AI systems transitioning from advice (stateless) to action (autonomous)
- Autonomous agents increasingly deployed in critical domains
- Traditional security models assume human oversight (infeasible at AI scale)
- Regulatory frameworks emerging (NIST, EU AI Act, ISO) demanding governance evidence
- High-profile AI incidents demonstrating need for trust architecture

#### Alignment with Standards
- NIST AI Risk Management Framework: IrisKey provides technical implementation
- ISO/IEC 42001: Supports AI management system requirements
- Zero Trust Architecture: Extends ZT principles to autonomous systems
- Domain-specific standards (ISO 26262, HIPAA, PSD2): IrisKey enables compliance

#### Vision for Trustworthy AI Future
- Autonomous systems will become ubiquitous (transportation, healthcare, infrastructure)
- Trust in these systems is not optional; it's necessary for social acceptance and regulatory compliance
- Identity Before Automation™ enables:
  - Continuous verification before action
  - Complete accountability (audit trails)
  - Immediate revocation of compromised authority
  - Risk-appropriate governance (context-aware verification)

#### Call to Action
1. **Researchers:** Explore formal verification of authorization models; quantum-resistant protocols
2. **Practitioners:** Adopt IrisKey principles in pilot projects; measure effectiveness
3. **Policymakers:** Align regulations with trust-architecture requirements; mandate audit trails
4. **Standards Bodies:** Formalize IrisKey components in ISO/IEC standards

#### Closing Statement
The future of trustworthy AI is not more capable models; it's more trustworthy governance. Identity Before Automation™ provides a blueprint for that future—a future where AI systems may reason deeply, but every significant action is independently verified and authorized before execution. This is not limitation; it's liberation—freeing AI to advance faster and more boldly because society can trust it.

---

## 27. References (Bibliography)

**Target: 150–200 academic sources**

### Categories

#### AI Governance & Safety (15–20 references)
- NIST AI Risk Management Framework
- Hendrycks et al. (AI safety)
- Recent work on AI alignment and control

#### Secure Multi-Agent Systems (10–15 references)
- Byzantine fault tolerance literature
- Secure coordination protocols
- Game theory in multi-agent systems

#### Cryptography & Identity (20–30 references)
- Digital signature standards
- Identity and access management
- Audit trail design
- Post-quantum cryptography

#### Autonomous Systems & Verification (15–20 references)
- Formal verification
- Safety-critical systems
- Autonomous vehicle standards
- Defence systems

#### Regulatory & Compliance (15–20 references)
- NIST standards and guidelines
- ISO/IEC 27001, 42001
- EU AI Act
- Domain-specific regs (HIPAA, PSD2, etc.)

#### Industry Practices (10–15 references)
- Zero Trust Architecture implementations
- API gateway security
- Log management and SIEM

#### Domain-Specific (30–50 references)
- Healthcare AI systems
- Autonomous vehicle research
- Financial fraud detection
- Critical infrastructure protection
- Defence and military applications
- Government digital identity systems

---

## 28. Appendices

### Suggested Appendices

#### Appendix A: Glossary
- 50–75 key terms defined
- Distinguishes: IrisKey concepts vs. standard terminology

#### Appendix B: Threat Model Detailed Matrix
- 11 threats × (description, current mitigation, IrisKey solution)
- Cross-references Five Gates and other components

#### Appendix C: Standards Mapping
- IrisKey ↔ NIST AI RMF
- IrisKey ↔ ISO/IEC 42001
- IrisKey ↔ Zero Trust Architecture
- IrisKey ↔ Domain-specific standards

#### Appendix D: Use Case Scenario Walkthrough
- Detailed 2–3 page scenario for each domain
- Shows Five-Gate in action with realistic data

#### Appendix E: Reference Implementation API Specification
- Full API definitions (JSON schema or similar)
- Code examples (pseudocode)

#### Appendix F: Regulatory Alignment Checklist
- Per-regulation verification of IrisKey compliance
- Can be used by adopters for audit purposes

#### Appendix G: Security Analysis
- Threat model detailed analysis
- Proof sketches for key security properties
- Known limitations and assumptions

#### Appendix H: Performance Specifications
- Detailed latency, throughput, scalability characteristics
- Deployment options and their performance implications

---

# Key Writing Principles

## Academic Rigor
- Every factual claim either cited or explicitly marked as IrisKey proposal
- Distinguish: established research / industry practice / IrisKey innovation
- No marketing language
- Precision over persuasion

## Structure & Flow
- Each section builds on prior sections
- Clear transitions between sections
- Repetition minimized (cross-references instead)
- Examples throughout (make abstract concepts concrete)

## Tone
- British English (formal academic)
- Active voice (where possible)
- Technical depth without sacrificing readability
- Assume reader has some background in security/AI; define domain-specific terms

## Visual Communication
- 15–20 diagrams (professional, publication-ready)
- Each diagram has caption + figure number
- Diagrams support text (not decorative)
- Mix: architectural, workflow, decision trees, timelines, matrices

---

# Final Validation Checklist

- [ ] All 28 sections drafted
- [ ] References: 150+ sources
- [ ] Diagrams: 15+ professional figures
- [ ] Threat model: 11 threats with complete analysis
- [ ] Use cases: 9 domains detailed
- [ ] No marketing language present
- [ ] All IrisKey claims clearly labeled as "proposed"
- [ ] References to standards (NIST, ISO, ZT) accurate
- [ ] Appendices: glossary, threat matrix, standards mapping, scenarios, API spec, compliance checklist, security analysis, performance specs
- [ ] Consistent style and tone throughout
- [ ] Suitable for presentation to Coventry University, Innovate UK, UKRI, defence, enterprise
