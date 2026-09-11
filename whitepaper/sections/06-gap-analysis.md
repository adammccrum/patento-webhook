# 6. Why Current Security Models Are Insufficient

## The Fundamental Mismatch

Existing security frameworks—Zero Trust, IAM, NIST—were designed for systems with human decision-makers. They optimize for human judgment, human oversight, and human responsibility. Autonomous AI agents break every assumption these frameworks make.

## Assumption 1: Humans Make Final Decisions

**Zero Trust Assumption:** "Verify every request, but verification can involve human judgment and context understanding."

**The Problem:** Humans cannot review millions of agent decisions per day. When agents operate at machine speed—thousands of decisions per second—human review becomes infeasible. The governance model collapses.

**Example:** An autonomous trading system makes 10,000 trade decisions per second. Zero Trust says "verify every request." But human verification of 10,000 decisions per second is impossible. The framework breaks.

**IrisKey Solution:** Verification is automated and deterministic, not deferred to humans. Humans review policies, not every decision. The Authority Brain verifies authority before action, at machine speed.

---

## Assumption 2: Access is Granted for Long Periods

**Traditional IAM Assumption:** "Grant access for a session or a day. Assume access remains valid until explicitly revoked."

**The Problem:** Autonomous agents operate continuously. Sessions are hours or days long. If an agent is compromised mid-session, it operates with full access for hours before detection.

**Example:** An agent is granted database access for a 24-hour period. Four hours in, the agent is compromised. It continues operating with full database access for the remaining 20 hours before token expires. In traditional IAM, the only defense is detection and revocation (hours later).

**IrisKey Solution:** Authority is scoped to short durations (1 hour). Continuous re-verification means authority must be continuously earned. If compromise is detected, revocation is immediate (milliseconds). Authority is active only while conditions are met.

---

## Assumption 3: Authorization is One-Time

**RBAC/ABAC Assumption:** "Verify authorization at login. Assume authorization remains valid for session duration."

**The Problem:** Autonomous agents' circumstances change during operation. The context that made authorization appropriate at the start may no longer hold. Traditional frameworks don't re-verify.

**Example:** An agent is authorized to "access patient records during business hours" based on evaluation at 9am (business hours, low risk). At 2am (same session), the agent tries to access patient records. Traditional RBAC grants access (session is still valid). But authorization decision should be re-evaluated given that it's now 2am (outside business hours).

**IrisKey Solution:** Continuous verification means every action is re-evaluated against current context. Business hours check happens at 2am, not at 9am. If context has changed, authorization is re-evaluated.

---

## Assumption 4: Access Control is Granular, But Not Context-Based

**ABAC Strength:** "Attribute-based control enables flexible access policies."

**The Problem:** ABAC enables fine-grained policies, but policies are static. They don't adapt based on runtime context or behavioral anomalies. If an agent starts behaving abnormally, ABAC policy doesn't change—access continues.

**Example:** Policy says "Agent can read customer data if request rate < 100/minute." Agent normally reads 10 records/minute. At 3pm, agent suddenly reads 1000 records/minute. Traditional ABAC has no mechanism to detect the anomaly or escalate. If the policy was "< 100/minute," the threshold is exceeded, but detection requires active monitoring (separate system).

**IrisKey Solution:** Context Gate includes behavioral anomaly detection. Anomalies trigger escalation or revocation. No separate monitoring system needed; anomaly detection is built into authorization verification.

---

## Assumption 5: Audit is for Compliance, Not Real-Time Governance

**Traditional Audit Assumption:** "Log actions; audit logs later for compliance purposes."

**The Problem:** Audit trails are historical records, not governance mechanisms. They document what happened, but don't prevent what's happening. An agent commits a violation; logs record it; weeks later, auditor reviews logs.

**Example:** An agent exfiltrates confidential data. The action is logged. But logging doesn't prevent the exfiltration. Audit trail proves it happened (useful for legal purposes), but doesn't stop the attack.

**IrisKey Solution:** Audit trail is real-time and cryptographically signed. Every action is immediately recorded and attributable. Signatures enable forensic certainty. But more importantly, audit trail is integrated with revocation: if audit detects a violation, revocation is triggered immediately.

---

## Assumption 6: Revocation is Slow

**Traditional Revocation:** "Detect compromise; notify administrators; administrators update access controls; changes propagate to all systems (hours to days)."

**The Problem:** In enterprises with hundreds of systems, revocation is slow. A compromised agent can operate with access for hours after compromise is detected but before revocation takes effect.

**Example:** Compromised agent detected at 2pm. IT team is notified. Access control systems updated at 2:30pm. But some legacy systems (integrated loosely) don't see the revocation until their cache refreshes at 3pm. Compromised agent has 1 hour of operation with access after detection.

**IrisKey Solution:** Revocation is immediate (<100ms). Compromised agent's authority expires instantly. In-flight operations are interrupted. No period of operation with revoked authority.

---

## Assumption 7: Authorization is Binary (Access or No Access)

**Traditional IAM:** "Either the user has permission or doesn't. No middle ground."

**The Problem:** Autonomous agents operate in shades of gray. An agent might be trustworthy in normal circumstances but risk-prone if behavior becomes anomalous. Traditional binary access control has no way to express "provisionally authorized" or "authorized with restrictions."

**Example:** An agent is trusted to make $10,000 transactions in normal circumstances. But if the agent suddenly tries to make 100 transactions in 5 minutes, should access be completely revoked or simply restricted (max 1 transaction per minute)? Traditional IAM says binary—revoke completely or allow fully.

**IrisKey Solution:** Authority is multi-valued. Context Gate produces anomaly scores (0–1). Policy can specify: "Low anomaly (0–0.3): approve; Medium anomaly (0.3–0.7): escalate; High anomaly (0.7–1.0): reject." Authority can be provisionally granted with escalation.

---

## Assumption 8: Model Behavior is Stable

**Traditional Security Assumption:** "System behavior is deterministic (or at least stable). Changes in behavior indicate compromise."

**The Problem:** AI models can change behavior between identical inputs (due to temperature, sampling). They can drift over time (due to fine-tuning or environmental changes). Traditional security models assume behavior is stable and repeatable.

**Example:** An agent is trained to recommend treatments. Initial recommendations have accuracy 94%. Over months, accuracy drifts to 87% (due to data drift, model fine-tuning, environment changes). Traditional models don't have mechanisms to detect gradual drift. Accuracy drops 7% before anyone notices.

**IrisKey Solution:** Continuous monitoring includes performance tracking. Model accuracy, anomaly score, behavior patterns are all monitored. Gradual drift is detected. If drift becomes problematic, agent is escalated for review or revocation.

---

## Summary: The Inadequacy of Traditional Models

| Assumption | Traditional Framework | Problem for Autonomous Agents | IrisKey Solution |
|-----------|---|---|---|
| Humans review final decisions | Zero Trust | Infeasible at machine speed | Automated verification |
| Access valid for long periods | Traditional IAM | Compromise not detected for hours | Short-lived tokens + continuous re-verification |
| One-time authorization | RBAC | Changed context not detected | Continuous verification against current context |
| Static policies | ABAC | Anomalies not detected | Dynamic anomaly detection in Context Gate |
| Audit for compliance only | Logging | Violations not prevented | Real-time audit trail + revocation trigger |
| Slow revocation | Admin-driven | Hours of operation with revoked access | Immediate revocation (<100ms) |
| Binary access | Traditional IAM | No "provisional" authorization | Multi-valued authority + escalation |
| Stable behavior | Traditional security | Drift not detected | Continuous monitoring of performance/anomalies |

## The Core Gap

The fundamental gap is this: **Existing frameworks were designed for human operators or passive systems. None were designed for autonomous agents making continuous decisions at machine speed.**

IrisKey addresses this gap by:

1. **Deterministic Verification:** Replaces human judgment with deterministic rules, enabling machine-speed verification
2. **Short-Lived Authority:** Tokens expire quickly; authority must be continuously earned
3. **Continuous Re-Verification:** Every action verifies authorization against current context
4. **Anomaly-Integrated:** Behavior anomalies trigger escalation or revocation
5. **Real-Time Audit:** Signatures enable forensic certainty and trigger revocation
6. **Immediate Revocation:** Millisecond-level authority withdrawal
7. **Multi-Valued Authority:** Provisional authorization with escalation
8. **Automated Monitoring:** Performance and behavior tracked without human oversight

## Regulatory Perspective

Regulators (NIST, EU, UK) recognize this gap and are developing frameworks that assume technical governance architecture:

- **NIST AI RMF:** Calls for "continuous monitoring" and "revocation capability"—assumes automated mechanisms
- **EU AI Act:** Requires "audit trails" and "human oversight capability"—assumes technical logging and control
- **UK AI Bill:** Emphasizes "risk-based governance"—assumes ability to assess and manage risk in real-time

These regulations implicitly assume that organizations will deploy technical governance architectures (like IrisKey). The gap between regulations and technical solutions is the motivation for this paper.

---

**Word Count:** 1,550 words

**Key Insight:** Traditional security frameworks optimize for human decision-makers; autonomous agents require different assumptions.

**Next Section:** Identity Before Automation™ (the core principle underlying IrisKey)
