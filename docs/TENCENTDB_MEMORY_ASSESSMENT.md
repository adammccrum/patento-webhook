# TencentDB Agent Memory — Evaluation

**Version:** 1.1
**Status:** **RESEARCH APPROVED · PRODUCTION INTEGRATION NOT APPROVED**
**Last Updated:** 2026-08-08
**Repository:** https://github.com/TencentCloud/TencentDB-Agent-Memory
**Related:** [MEMORY_PROVIDER_SPECIFICATION.md](MEMORY_PROVIDER_SPECIFICATION.md), [BACKLOG.md](BACKLOG.md)

---

## Status

| | |
|---|---|
| **Research** | **APPROVED** — investigation may proceed under the constraints below |
| **Production integration** | **NOT APPROVED** |
| Adapter enabled | No. `tencentdb-agent-memory` stays `enabled: false` |
| Packages installed | None. No TencentDB dependency exists in this repository |

### Explicitly rejected for our architecture

These are settled decisions, not open questions. None is revisited by a
successful spike.

1. **Claude Code reverse-proxy integration** (`ANTHROPIC_BASE_URL` repointed at
   MemoryProxy).
2. **Automatic end-of-turn memory writes.**
3. **Retrieved memory injected directly into system prompts.**
4. **Default external LLM / embedding egress.**
5. **Tencent TCVDB / COS storage for LAO learner data.**
6. **Any memory path capable of bypassing EOS governance.**

### The only eligible surface

The smallest MemoryCore API boundary — the `/v3/...` HTTP endpoints — called by
our own adapter behind `MemoryProvider`. Nothing else.

---

## Summary

TencentDB Agent Memory is a real, active, MIT-licensed project and a credible
candidate for the memory engine behind our `MemoryProvider` abstraction.

**However, its default Claude Code integration mode is not acceptable to us.**
The documented way to use it with Claude Code is to repoint `ANTHROPIC_BASE_URL`
at a local proxy that intercepts every request, captures every turn
automatically, and injects stored memory straight into the system prompt. That
single design decision conflicts with four of our ten requirements at once
(explicit writes, no default external egress, memory-is-not-authority, and
governance boundaries).

There is a second, much smaller integration surface — MemoryCore's HTTP API —
that avoids all of it. **That is the only path we should evaluate further.**

Recommendation: proceed to a **time-boxed, local-only, read-mostly spike behind
the `MemoryProvider` interface**, in a scratch workspace, with no dependency
added to this repository. Do not adopt the proxy.

---

## 1. Repository Inspection

| Property | Value |
|----------|-------|
| Owner / repo | `TencentCloud/TencentDB-Agent-Memory` |
| Language | TypeScript |
| Stars / forks | ~17,600 / ~1,570 |
| Open issues | ~551 |
| Created | 2026-04-07 |
| Last updated | 2026-08-08 (active) |
| **Default branch** | **`feat/server_team`** — not `main` |
| Topics | `agent`, `long-term-memory`, `local-first`, `vector-search`, `openclaw-plugin` |

### Components

| Component | Port | Role |
|-----------|------|------|
| MemoryCore | 8420 | Memory engine. L0–L3 pipeline, SQLite in standalone mode. |
| MemoryPanel / Hub | 8125 | Web control panel. Browse, review, bind and ACL memory assets. |
| MemoryKnowledge | 8424 | Wiki pages with link graphs; CodeGraph symbol/call indexing. |
| MemoryProxy | 8096 | **LLM reverse proxy** that sits between the agent and the model API. |
| sdk/memory-core | — | Programmatic bindings. |

### Memory model

Four layers — `L0` raw conversation, `L1` atoms (facts, preferences,
constraints), `L2` scenario blocks, `L3` core/persona — plus four asset types:
Chat Memory, Skill, Wiki, CodeGraph. Retrieval is BM25 + vector + RRF, falling
back from L2/L3 to L1/L0 for specific facts.

This maps reasonably onto our scopes: L2/L3 ≈ `project`, L1 ≈ `project`/`learner`
atoms, L0 ≈ `session`. It has **no equivalent of our `operational` scope**, and
its persona layer blurs the learner/project boundary we require.

Visibility model is `private` / `team` / `restricted` / `agent`, private by
default — this part is genuinely well aligned with our requirements.

---

## 2. Licence

- **LICENSE file:** MIT, `Copyright (C) 2026 Tencent. All rights reserved.`
- **GitHub SPDX detection:** `NOASSERTION` — the file carries a non-standard
  preamble, so GitHub's classifier will not assert MIT.
- MIT permits commercial use with no field-of-use restriction. Obligation is
  attribution.

**Findings:**

1. **F-L1 (low):** Automated licence scanners will flag this as
   `NOASSERTION`/unknown. Our policy tooling needs an explicit override entry
   recording the manual determination of MIT, or it will fail CI later.
2. **F-L2 (low):** `MemoryProxy/package.json` has **no `license` field** and is
   versioned `0.1.0` under the internal name `context-proxy`. Sub-package
   licensing is inherited by assumption, not by declaration.
3. **F-L3 (medium):** Transitive dependency licences have not been audited. One
   optional dependency is `cos-nodejs-sdk-v5` (Tencent Cloud Object Storage);
   the full tree needs an SBOM pass before anything is adopted.

---

## 3. Dependencies

`MemoryProxy` (`context-proxy@0.1.0`), described as *"Lightweight LLM request
forwarding proxy with JSONL logging and Opik tracing"*:

```
@clickhouse/client   ^1.22.0    @opentelemetry/api       ^1.9.1
@hono/node-server    ^1.13.7    @opentelemetry/sdk-node  ^0.219.0
@langfuse/otel       ^5.9.0     hono                     ^4.7.10
@langfuse/tracing    ^5.9.0     ioredis                  ^5.11.1
js-yaml              ^4.1.0     node-pty                 ^1.1.0

optional: better-sqlite3 ^11.5.0, cos-nodejs-sdk-v5 ^3.0.0,
          @context-proxy/cost-guard (file:)
```

**Findings:**

1. **F-D1 (high):** A full **observability stack — Langfuse + OpenTelemetry +
   ClickHouse + Opik tracing** — is a first-class dependency of the component
   that sees every prompt and response. Whether it is off by default is a
   configuration question we have not verified. If enabled, prompts and
   completions leave the process. This must be proven inert before use.
2. **F-D2 (high):** **`node-pty`** — pseudo-terminal spawning — is a dependency
   of an LLM proxy. There is no obvious reason a request-forwarding proxy needs
   to spawn terminals. Until the call sites are read, treat this as a component
   capable of executing processes on the host while handling untrusted model
   output.
3. **F-D3 (medium):** `cos-nodejs-sdk-v5` gives the proxy a code path to
   Tencent Cloud Object Storage.
4. **F-D4 (medium):** All dependencies use caret ranges; lockfiles exist
   (`package-lock.json` **and** `pnpm-lock.yaml` — two lockfiles in one
   package, which is itself a smell).
5. **F-D5 (low):** `better-sqlite3` and `node-pty` are native modules requiring
   a toolchain to build — relevant to Mac support below.

---

## 4. Mac / Claude Code Compatibility

### Claude Code

Integration is documented and it does work. The documented method is:

```bash
export ANTHROPIC_BASE_URL=http://127.0.0.1:8096/claude-code/default
export ANTHROPIC_AUTH_TOKEN="$(cat ./.admin-key)"
claude --model <PROXY_UPSTREAM_MODEL>
```

The proxy *"forwards OpenAI `/v1/chat/completions` and Anthropic `/v1/messages`
verbatim"*, injects skills and knowledge *"directly into the system prompt"*,
and *"at the end of each human turn, sends the conversation slice to MemoryCore
`/v3/skill/conversation/add`"*.

**Compatibility verdict: works, but the mechanism is the problem, not the
compatibility.** See risks R1–R3. First-class framework support is listed for
OpenClaw, Hermes and CodeBuddy; Claude Code support is via this generic proxy
route. There is no official MCP server for Claude Code — several third-party
forks exist (`Lorenzocolucci/tencentdb-agent-memory-claude-code`,
`baodq97/tencentdb-agent-memory`), which are **not** in scope for approval.

The supported path for us is **MemoryCore's HTTP API directly** (`/v3/...`),
called by our own adapter. That requires no proxy, no `ANTHROPIC_BASE_URL`
change, and no credential substitution.

### macOS

| Aspect | Status |
|--------|--------|
| Node `>= 22.16` | Fine on macOS. |
| Docker Compose deployment | Fine with Docker Desktop / Colima. |
| Base image `node:22-slim` | Upstream is multi-arch; arm64 available. |
| **Project's own images** | **No published arm64 image and no multi-arch build documented.** |
| Native modules (`better-sqlite3`, `node-pty`) | Need Xcode Command Line Tools for source builds. |
| Documented macOS guidance | **None.** No macOS or Apple Silicon section in any README or INSTALL doc. |

**Findings:**

1. **F-M1 (medium):** No stated Apple Silicon support. Expect either an
   emulated `linux/amd64` run under Rosetta (slow, and a known source of native
   module failures) or a local build. Unproven either way.
2. **F-M2 (low):** Zero macOS documentation across ~40k words of install and
   deployment docs suggests macOS is not a tested target.

---

## 5. Security & Privacy Risks

Ordered by severity.

### R1 — Proxy interception of all Claude Code traffic (**Critical**)

Routing Claude Code through MemoryProxy means every request body — full
conversation history, file contents, diffs, tool calls and tool results —
passes through a third-party service on the way to the model, and is written to
disk (JSONL logging is in the component's own description).

For this codebase that includes IrisKey and LAO material. For `learner` scope it
would be a straightforward data protection problem.

*Mitigation: do not use proxy mode. Ever, for any scope.*

### R2 — Automatic, implicit memory capture (**Critical**)

Memory is written *"at the end of each human turn"* with no user action. This is
the direct opposite of our requirement 3 (writes must be explicit and
auditable). There is no per-write audit event under our control, no reason
recorded, and no approval gate.

*Mitigation: only use explicit `POST /v3/...` calls from our own adapter, which
we audit ourselves before calling.*

### R3 — Memory auto-injected into the system prompt (**Critical**)

Retrieved skills and knowledge are *"injected directly into the system
prompt"*. System-prompt position is the highest-trust region of the context
window. This makes stored memory read as instruction rather than as evidence,
violating requirements 7, 8 and 9 simultaneously.

It also creates a **persistent prompt-injection channel**: text written into a
document or conversation once can be distilled into a memory asset and then
re-injected into the system prompt of every future session. Memory poisoning
here is durable and cross-session.

*Mitigation: our adapter retrieves memory and places it in user-turn context,
delimited and labelled untrusted, per the trust model in
[MEMORY_PROVIDER_SPECIFICATION.md](MEMORY_PROVIDER_SPECIFICATION.md).*

### R4 — Default external LLM and embedding egress (**High**)

Observed deployment defaults:

```
TDAI_LLM_BASE_URL=https://api.openai.com/v1
TDAI_LLM_MODEL=gpt-4o
embeddings: text-embedding-3-small (1536 dims), client-side, enabled by default
```

The L0→L3 distillation pipeline is an LLM process. Out of the box, **captured
conversation content is sent to OpenAI** for extraction and embedding. This
breaks requirement 2 by default, not by misconfiguration.

*Mitigation: point `TDAI_LLM_BASE_URL` at a local Ollama/vLLM endpoint — which
we already have in the provider registry — and verify with egress monitoring,
not by reading config.*

### R5 — Tencent Cloud dependency and data residency in service mode (**High**)

Service mode uses **TCVDB** (Tencent Cloud Vector Database), **COS** (object
storage) and Redis. In that mode embeddings are computed server-side by TCVDB.
This is cross-border data transfer for anything learner-related and needs a
lawful basis and a DPA before it could be considered.

*Mitigation: standalone/SQLite mode only. Service mode is out of scope.*

### R6 — Undetermined telemetry (**High**)

No telemetry disclosure exists in any README, yet the proxy ships Langfuse,
OTel, ClickHouse and Opik tracing. Absence of a disclosure is not absence of
telemetry.

*Mitigation: blocking gate — verify with an egress-monitored run before any
adoption decision.*

### R7 — Credential handling (**Medium**)

- The admin key is auto-generated as `sk-mem-<32 chars>` and persisted **in
  plaintext to `./.admin-key`** in the working directory. Real risk of being
  committed.
- In proxy mode, `ANTHROPIC_AUTH_TOKEN` is *replaced* by the `sk-mem-` key and
  the proxy holds the real upstream credential. Our Anthropic credential
  management moves into a third-party component.

*Mitigation: no proxy mode; `.admin-key` and `.memory/` added to `.gitignore`
before any local spike.*

### R8 — CodeGraph repository indexing (**Medium**)

CodeGraph *"currently prioritizes public HTTPS repositories; support for private
repositories and SSH credentials is still being refined."* Our repositories are
private. Indexing them means shipping source into the memory pipeline — and by
R4, potentially to an external LLM.

*Mitigation: CodeGraph disabled entirely for the spike.*

### R9 — Project maturity (**Medium**)

Four months old; default branch is a feature branch (`feat/server_team`) rather
than `main`; ~551 open issues; the proxy is `0.1.0`; two competing lockfiles in
one package. High star count reflects attention, not stability.

*Mitigation: pin to a specific commit SHA, never a branch or `latest` tag.*

### R10 — Erasure and correction support unverified (**Medium**)

Our requirements 5 and 6 demand delete, correction, expiry and provenance. The
docs describe review and ACLs but not a subject-level erasure guarantee across
L0–L3 and derived assets. A memory distilled from a deleted L0 record may
survive its source.

*Mitigation: this is a functional acceptance test in the spike — delete a
subject, then verify no derived L1/L2/L3 asset retains the content.*

---

## 6. Smallest Integration Path

Five steps, none of which touch this repository's runtime.

**Step 0 — Prerequisite (blocking).** Land the `MemoryProvider` interface and
`LocalMemoryAdapter` first. TencentDB is only ever reachable through that
interface. If the abstraction does not exist, the spike does not start.

**Step 1 — Isolated local instance.** Standalone/SQLite mode, in a scratch
workspace outside this repo, on a pinned commit SHA. Bound to `127.0.0.1` only.
`PROXY_FULL_STACK` off; ideally MemoryProxy not started at all. CodeGraph off.
`.admin-key` gitignored.

**Step 2 — Sever external egress.** Point `TDAI_LLM_BASE_URL` at a local
Ollama/vLLM endpoint. Disable client-side embedding or repoint it locally. Then
**run with egress monitoring** and record every outbound connection observed.
This step answers R4 and R6 with evidence rather than configuration claims.

**Step 3 — Thin read-mostly adapter.** Implement `TencentMemoryAdapter` against
MemoryCore's HTTP API only — `read`, `search`, `getProvenance`, plus `write` for
a single non-sensitive `project`-scope kind. No proxy. No
`ANTHROPIC_BASE_URL` change. Scope allow-list: `project` only; `learner`
hard-blocked at the interface.

**Step 4 — Acceptance tests against our ten requirements.** Specifically:
delete/correct/expire actually propagate to derived layers (R10); provenance
survives round-trip; `export()` output is portable to `LocalMemoryAdapter`;
memory arrives labelled and untrusted, never in the system prompt.

**Step 5 — Written review.** Findings back into this document. Adoption
decision made explicitly, or the spike is discarded and the local adapter
stands alone. Discarding is a perfectly good outcome.

**Explicitly out of scope:** proxy mode, service mode, TCVDB/COS, CodeGraph on
private repos, `learner` scope, any production wiring, any dependency added to
`package.json`.

---

## 7. Decision Gates

All must pass before adoption is even reconsidered:

| # | Gate | Status |
|---|------|--------|
| G1 | Zero unexpected outbound connections under egress monitoring | ☐ Not tested |
| G2 | `node-pty` call sites read and justified, or component excluded | ☐ Not tested |
| G3 | Tracing stack proven inert by default | ☐ Not tested |
| G4 | Subject erasure verified across L0–L3 and derived assets | ☐ Not tested |
| G5 | Runs natively on Apple Silicon without emulation | ☐ Not tested |
| G6 | SBOM / transitive licence audit clean | ☐ Not started |
| G7 | Provenance survives write → read → export round-trip | ☐ Not tested |
| G8 | Local adapter shipped and passing first | ☑ **Done** — `LocalMemoryAdapter`, 82 tests passing |

---

## 8. Current Position

- **Research:** approved, under the six rejections and the single eligible
  surface recorded at the top of this document.
- **Production integration:** not approved. No packages installed, no proxy, no
  telemetry, no production wiring changed.
- **G8 is met.** `LocalMemoryAdapter` is implemented and validated against
  [MEMORY_PROVIDER_SPECIFICATION.md](MEMORY_PROVIDER_SPECIFICATION.md), with
  adversarial coverage for stored prompt injection and authority isolation.
- **Next action:** MEM-7 sub-tasks (G1–G7). Those are evidence-gathering
  exercises in a scratch workspace; none of them adds a dependency here.
