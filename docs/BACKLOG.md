# Engineering Backlog

**Status:** Living document
**Last Updated:** 2026-08-08

Items are grouped by workstream. Nothing here is approved for production until
its gates pass.

---

## Memory Subsystem

Design: [MEMORY_PROVIDER_SPECIFICATION.md](MEMORY_PROVIDER_SPECIFICATION.md)
Evaluation: [TENCENTDB_MEMORY_ASSESSMENT.md](TENCENTDB_MEMORY_ASSESSMENT.md)

### MEM-1 — Ratify the MemoryProvider specification
**Priority:** High · **Status:** Ready for review · **Blocks:** everything below

Review and sign off the interface, the four scopes, the record schema, the
trust model and the egress gate. Resolve the open design questions at the end
of the spec.

### MEM-2 — Implement `LocalMemoryAdapter`
**Priority:** High · **Status:** Not started · **Depends on:** MEM-1

SQLite-backed, no network egress. Full interface including `correct()`,
`delete(hard)`, `expire()`, `purgeSubject()`, `getProvenance()` and `export()`.
This is the default and the reference implementation. It must ship and pass
before any external engine is evaluated further.

### MEM-3 — Implement `MockMemoryAdapter` and the conformance suite
**Priority:** High · **Status:** Not started · **Depends on:** MEM-1

One shared test suite every memory adapter must pass. Includes the
replaceability tests from the specification.

### MEM-4 — Wire memory writes into the audit trail
**Priority:** High · **Status:** Not started · **Depends on:** MEM-2

Every `write`/`correct`/`delete` emits an audit event before acknowledgement,
using the schema in [AUTHORIZATION_AND_AUDIT.md](AUTHORIZATION_AND_AUDIT.md).
Failed audit write ⇒ failed memory write. Restricted-scope writes route through
the existing approval gate.

### MEM-5 — Untrusted-recall context framing
**Priority:** High · **Status:** Not started · **Depends on:** MEM-2

Retrieved memory is delimited, attributed, labelled with its trust level, and
placed in user-turn context — never in the system prompt. Includes a
prompt-injection test corpus: a poisoned memory must not change agent
behaviour, grant permission, or override a deterministic rule.

### MEM-6 — Local embedding strategy for retrieval
**Priority:** Medium · **Status:** Not started · **Depends on:** MEM-2

Local-first must hold for search as well as storage. Evaluate local embedding
via the existing Ollama/vLLM registry entries, or BM25-only as a first cut.

### MEM-7 — TencentDB Agent Memory spike (time-boxed)
**Priority:** Medium · **Status:** Blocked on MEM-2 · **Gates:** G1–G8

Steps 1–5 of the integration path in the assessment. Local-only, read-mostly,
`project` scope only, pinned commit SHA, no proxy, no service mode, no
dependency added to this repository. Discarding the spike is an acceptable
outcome.

Blocking sub-tasks, each producing evidence not assertions:

- **MEM-7a** — Egress-monitored run; record every outbound connection (G1, G3).
- **MEM-7b** — Read `node-pty` call sites in MemoryProxy and justify or exclude
  the component (G2).
- **MEM-7c** — Subject-erasure test across L0–L3 and derived assets (G4).
- **MEM-7d** — Apple Silicon native-run check (G5).
- **MEM-7e** — SBOM and transitive licence audit (G6).
- **MEM-7f** — Provenance round-trip and cross-adapter `export()` portability
  (G7).

### MEM-8 — Licence policy override entry
**Priority:** Low · **Status:** Not started

GitHub reports `NOASSERTION` for TencentDB Agent Memory although the LICENSE is
MIT. Record the manual determination in policy tooling so scanners do not fail
CI later. Note that `MemoryProxy/package.json` declares no licence field.

---

## Decisions Recorded

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-08-08 | Memory access goes through a `MemoryProvider` interface; no engine SDK in application code | Requirement 10 — engine must be replaceable |
| 2026-08-08 | **Reject MemoryProxy / `ANTHROPIC_BASE_URL` interception mode outright** | Intercepts all Claude Code traffic, captures every turn implicitly, injects memory into the system prompt — conflicts with requirements 2, 3, 7, 8, 9 |
| 2026-08-08 | Memory fails closed, never falls back to another store | A split memory record defeats the audit trail |
| 2026-08-08 | `learner` scope is local-only and never eligible for an external adapter | Requirement 2; data protection |
| 2026-08-08 | Local adapter ships before any external engine is adopted | Avoids designing the abstraction around one vendor |
