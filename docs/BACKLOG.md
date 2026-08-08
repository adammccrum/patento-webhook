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
**Priority:** High · **Status:** Accepted 2026-08-08 · **Blocks:** everything below

Review and sign off the interface, the four scopes, the record schema, the
trust model and the egress gate. Resolve the open design questions at the end
of the spec.

### MEM-2 — Implement `LocalMemoryAdapter`
**Priority:** High · **Status:** **Done** — `src/providers/adapters/memory/local-memory-adapter.js`

No network egress, no runtime dependencies. Full interface including
`correct()`, `delete(hard)`, `expire()`, `purgeSubject()`, `getProvenance()`
and `export()`. This is the default and the reference implementation.

Storage is an append-only JSONL journal behind a `JournalStore` interface,
**not** SQLite as originally specified. Append-only gives supersede-not-
overwrite and a replayable history directly, and needs no native module — which
matters because `better-sqlite3` would have been the first native build
dependency in the repo. Erasure beats append-only: `hardRemove()` rewrites the
journal without the erased content and leaves a contentless tombstone. Swapping
in SQLite later is one file and no adapter change.

### MEM-3 — Implement `MockMemoryAdapter` and the conformance suite
**Priority:** High · **Status:** Partial — 82 tests live in `tests/memory/`; the shared cross-adapter conformance harness and `MockMemoryAdapter` are still to be extracted from them

One shared test suite every memory adapter must pass. Includes the
replaceability tests from the specification.

### MEM-4 — Wire memory writes into the audit trail
**Priority:** High · **Status:** **Done** within the memory subsystem — `AuditSink` still to be pointed at the system-wide audit logger when that exists

Every `write`/`correct`/`delete` emits an audit event before acknowledgement,
using the schema in [AUTHORIZATION_AND_AUDIT.md](AUTHORIZATION_AND_AUDIT.md).
Failed audit write ⇒ failed memory write. Restricted-scope writes route through
the existing approval gate.

### MEM-5 — Untrusted-recall context framing
**Priority:** High · **Status:** **Done** — `recall.js`, with an adversarial corpus in `tests/memory/prompt-injection.test.js`

Retrieved memory is delimited, attributed, labelled with its trust level, and
placed in user-turn context — never in the system prompt. Includes a
prompt-injection test corpus: a poisoned memory must not change agent
behaviour, grant permission, or override a deterministic rule.

### MEM-6 — Local embedding strategy for retrieval
**Priority:** Medium · **Status:** Not started · **Depends on:** MEM-2

Local-first must hold for search as well as storage. Evaluate local embedding
via the existing Ollama/vLLM registry entries, or BM25-only as a first cut.

### MEM-7 — TencentDB Agent Memory spike (time-boxed)
**Priority:** Medium · **Status:** Gated — G8 met, G1–G7 outstanding · **Gates:** G1–G7

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
| 2026-08-08 | TencentDB Agent Memory: **research approved, production integration not approved** | Assessment accepted; risks R1–R10 stand |
| 2026-08-08 | Six integration modes explicitly rejected (proxy, auto end-of-turn writes, system-prompt injection, default external egress, TCVDB/COS for learner data, any governance-bypassing path) | Each conflicts with a stated requirement; not reopened by a successful spike |
| 2026-08-08 | Only eligible TencentDB surface is the MemoryCore `/v3/...` API behind our own adapter | Smallest boundary that avoids all six rejected modes |
