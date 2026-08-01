# LLM Provider Specification

**Status:** Design only. No implementation is authorised by this document.
**Date:** 2026-08-01
**Purpose:** Define how the Solution workspace talks to a language model without ever knowing which one.

---

## 1. The governing rule

> The Solution workspace must never know which model produced a response.

Everything below follows from that. The workspace asks for *collaboration on a solution*; it does not ask Claude, or GPT, or Gemini. Which model serves the request is an operational decision made behind the boundary, changeable without touching a single line of workspace code.

A concrete test of compliance: **grep the app for provider names.** If `apps/lao-web` ever contains the strings `anthropic`, `openai`, `gemini`, `claude`, or `gpt`, the abstraction has leaked.

---

## 2. What exists today

`packages/iriskey/providers` already defines `IProvider`, `ILLMProvider`, `ChatMessage`, a `ProviderRouter` and a `CostCalculator`.

**It has zero provider implementations.** There is no HTTP client to any model vendor anywhere in this repository. The existing `ILLMProvider` is a reasonable starting shape but is not sufficient as written:

| Gap | Why it matters |
|---|---|
| `options?: Record<string, any>` | Untyped. Every caller invents its own keys; nothing is portable. |
| No token/usage reporting | Cost and credits cannot be computed from a response. |
| No cancellation | A learner who closes the workspace should stop paying for tokens. |
| No structured output | The collaborator needs to return a *revised solution*, not prose. |
| No tool/function calling | Needed later for solutions that act, not just draft. |
| No error taxonomy | Callers cannot distinguish "rate limited, retry" from "your prompt was rejected". |
| `complete()` and `chat()` both exist | Two ways to do one thing. Chat subsumes completion. |

This specification supersedes `ILLMProvider`. The existing interface should be **replaced**, not extended — it has no implementations, so there is nothing to migrate.

---

## 3. Layering

```
┌─────────────────────────────────────────────────────────┐
│  Solution workspace  (apps/lao-web)                     │
│  "Improve this solution with me"                        │
│  Knows: CollaboratorRequest / CollaboratorResponse       │
│  Knows nothing about models, vendors, keys, or tokens   │
└───────────────────────────┬─────────────────────────────┘
                            │  Collaborator API (§4)
┌───────────────────────────▼─────────────────────────────┐
│  Collaborator service                                    │
│  Builds prompts from Solution + usage. Owns LAO's voice. │
│  Decides intent → capability requirements.               │
└───────────────────────────┬─────────────────────────────┘
                            │  LanguageModel port (§5)
┌───────────────────────────▼─────────────────────────────┐
│  Provider router                                         │
│  Selection, fallback, retries, budget enforcement        │
└───────────────────────────┬─────────────────────────────┘
                            │  LanguageModel port (§5)
┌──────────┬──────────┬─────┴──────┬────────────┬─────────┐
│ Anthropic│ OpenAI   │ Gemini     │ OpenAI-     │ Future  │
│ adapter  │ adapter  │ adapter    │ compatible  │ adapter │
│          │          │            │ (Ollama,    │         │
│          │          │            │  vLLM, …)   │         │
└──────────┴──────────┴────────────┴────────────┴─────────┘
```

Two ports, not one. The workspace speaks **Collaborator**; only the router and adapters speak **LanguageModel**. This is what keeps model vocabulary (tokens, temperature, system prompts) out of the product.

---

## 4. The Collaborator port — what the workspace sees

```ts
type CollaboratorIntent =
  | 'improve'      // "This isn't quite working" → propose a revised solution
  | 'explain'      // "Why does this work?"      → prose, no revision
  | 'diagnose'     // "It gave me the wrong output" → find the cause
  | 'draft';       // "Help me start"            → produce a first version

interface CollaboratorRequest {
  intent: CollaboratorIntent;
  solutionId: string;
  /** What the learner said, in their words. Optional for 'improve'. */
  message?: string;
  /** Prior turns in this workspace session. */
  history?: CollaboratorTurn[];
  /** Caller-supplied idempotency key; a retry must not double-charge. */
  requestId: string;
}

interface CollaboratorResponse {
  /** Prose for the learner. Always present. */
  reply: string;
  /**
   * A concrete revision, when the intent produced one. The workspace shows
   * this as a diff and saves it as a new version only if the learner accepts.
   * The collaborator never writes to the database itself.
   */
  proposedContent?: string;
  /** One-line summary suitable for a version changeNote. */
  changeSummary?: string;
  /** Opaque. For support and analytics; never rendered. */
  traceId: string;
}
```

**Notes on the shape:**

- There is no `model`, `provider`, `temperature`, or `tokens` field. Deliberate.
- `proposedContent` is a *proposal*. The learner accepts or discards it, and acceptance goes through the existing versioning path (`PATCH /api/solutions/[id]`), which already creates a version transactionally. The collaborator must not acquire write access to solutions.
- `requestId` makes retries safe. Two calls with the same `requestId` must yield one charge.

### Streaming

The workspace should stream `reply` so a slow model still feels responsive:

```ts
interface CollaboratorStreamEvent {
  type: 'reply-delta' | 'proposal' | 'done' | 'error';
  text?: string;                 // reply-delta
  proposedContent?: string;      // proposal (emitted whole, not streamed)
  error?: CollaboratorError;     // error
}
```

`proposedContent` is emitted whole. A half-streamed prompt revision is dangerous to show — a learner could copy a truncated solution.

---

## 5. The LanguageModel port — what adapters implement

```ts
interface LanguageModel {
  readonly id: string;                 // 'anthropic:claude-sonnet-5'
  readonly vendor: string;             // 'anthropic' — for ops only, never surfaced
  readonly capabilities: ModelCapabilities;

  generate(req: ModelRequest, ctx: CallContext): Promise<ModelResult>;
  stream(req: ModelRequest, ctx: CallContext): AsyncIterable<ModelChunk>;
  health(): Promise<HealthStatus>;
}

interface ModelCapabilities {
  maxContextTokens: number;
  maxOutputTokens: number;
  supportsStreaming: boolean;
  supportsStructuredOutput: boolean;   // native JSON-schema-constrained output
  supportsTools: boolean;
  supportsSystemPrompt: boolean;       // false for some open-source chat models
  /** Cost per million tokens, in credits, for budgeting. */
  inputCostPerMTok: number;
  outputCostPerMTok: number;
}

interface ModelRequest {
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxOutputTokens: number;
  temperature?: number;
  /** When set, the adapter must return JSON conforming to this schema. */
  responseSchema?: JSONSchema;
  stopSequences?: string[];
}

interface CallContext {
  /** Cancellation. Closing the workspace must abort in-flight generation. */
  signal: AbortSignal;
  /** Ties spend and logs to a user without exposing identity to the vendor. */
  tenantId: string;
  requestId: string;
  /** Hard ceiling. The router refuses the call if the estimate exceeds it. */
  budgetCredits?: number;
}

interface ModelResult {
  text: string;
  /** Parsed and validated when responseSchema was set. */
  structured?: unknown;
  usage: { inputTokens: number; outputTokens: number };
  finishReason: 'stop' | 'length' | 'content_filter' | 'tool_use';
  modelId: string;
}
```

### Adapter obligations

Every adapter must:

1. **Translate faithfully, never enrich.** No adapter may inject prompt text. LAO's voice lives in the collaborator service, once, so that changing provider cannot change tone.
2. **Emulate what it lacks, or declare it.** A model without native structured output must either be driven by prompt-and-validate *inside the adapter*, or declare `supportsStructuredOutput: false` so the router does not select it for `improve`. It must never silently return unvalidated prose where JSON was requested.
3. **Normalise errors** to the taxonomy in §7. Vendor error shapes must not escape the adapter.
4. **Report true token usage.** If a vendor does not return counts, the adapter estimates and marks the result — it must not report zero.
5. **Honour `signal`.** Aborting must close the underlying HTTP connection, not merely stop reading.
6. **Never log prompt or completion content.** Learners' solutions are their work; §8.

### Provider-specific notes

| Provider | Considerations |
|---|---|
| **Anthropic** | System prompt is a top-level parameter, not a message. Structured output via tool-use. Streaming is SSE with content-block deltas. |
| **OpenAI** | System prompt is a message with `role: 'system'`. Native JSON-schema response format. |
| **Gemini** | Roles are `user`/`model`, not `user`/`assistant` — the adapter maps them. System instruction is a separate field. `responseMimeType` + schema for structured output. |
| **Open-source** (Ollama, vLLM, llama.cpp) | Usually OpenAI-compatible; one `OpenAICompatibleAdapter` parameterised by base URL covers most. Frequently no structured-output support and small context windows — declare capabilities honestly rather than optimistically. Self-hosted means cost per token is zero but capacity is finite; the router should treat it as rate-limited rather than free. |

Adding a provider must require **exactly one new file** implementing `LanguageModel`, plus a registry entry. If it requires touching the collaborator or the workspace, this specification has been violated.

---

## 6. Selection and fallback

The collaborator declares *requirements*; the router picks a model.

```ts
interface ModelRequirements {
  needsStructuredOutput: boolean;
  minContextTokens: number;
  /** 'quality' for improve/diagnose, 'speed' for short explanations. */
  prefer: 'quality' | 'speed' | 'cost';
}
```

Selection order: filter by capability → filter by health → filter by budget → order by `prefer` → return the ranked list.

**Fallback rules:**

- Retry the *same* model on `RATE_LIMITED` and `TRANSIENT` (exponential backoff, jitter, cap at 3 attempts).
- Fall to the *next* model on `UNAVAILABLE` or repeated transient failure.
- **Never** fall back on `INVALID_REQUEST` or `CONTENT_FILTERED` — a different model will fail the same way, and retrying burns money.
- If every candidate fails, return `CollaboratorError` with `retryable: true`. The workspace shows "The collaborator isn't available right now" — never a vendor name or a raw error.

**Determinism for cost:** the router records which model served each request in `traceId`'s trace record, so spend is attributable after the fact even though selection is dynamic.

---

## 7. Error taxonomy

```ts
type CollaboratorErrorCode =
  | 'RATE_LIMITED'      // retryable, backoff
  | 'TRANSIENT'         // retryable, backoff
  | 'UNAVAILABLE'       // retryable with a different model
  | 'INVALID_REQUEST'   // not retryable — our bug
  | 'CONTENT_FILTERED'  // not retryable — surface honestly to the learner
  | 'BUDGET_EXCEEDED'   // not retryable — the learner is out of credits
  | 'CANCELLED';        // learner aborted; charge nothing

interface CollaboratorError {
  code: CollaboratorErrorCode;
  /** Safe to show a learner. Never contains a vendor name or raw vendor text. */
  message: string;
  retryable: boolean;
  traceId: string;
}
```

`CONTENT_FILTERED` deserves care: if a learner's solution triggers a vendor filter, the honest message is that the request was refused — not a pretence that the service is down.

---

## 8. Privacy, cost, and trust

**Solutions are the learner's work.** A solution's content is the thing they built and rely on. Three constraints follow:

1. **No content logging.** Traces record token counts, latency, model id, and outcome. Never prompt or completion text. Debugging happens through reproduction, not surveillance.
2. **No training by default.** Adapters must send whatever vendor header opts out of training on inputs, where one exists. If a provider offers no such control, that must be recorded in the registry entry and treated as a procurement decision, not a default.
3. **`tenantId`, never user identity.** Adapters receive an opaque tenant identifier for abuse attribution. Email addresses and names never cross the boundary.

**Cost** flows through the existing `Credits` model. The router estimates before calling (`inputCostPerMTok` × estimated tokens) and refuses if it would exceed `budgetCredits`. Actual usage is reconciled from `ModelResult.usage` after the call. A `CANCELLED` request charges for tokens already produced and nothing more.

---

## 9. Where this plugs into the product

The collaborator already has a place to live. `apps/lao-web/src/lib/solutions.ts#getCollaboratorPrompt` observes real usage and produces an observation and a question:

> "You've used this 12 times and it's still on the first version."
> "You'll have noticed things by now. Want to improve it together?"

Today that question leads nowhere — the workspace's "Improve it" button opens a plain textarea. **That button is the integration point.** When a provider exists, accepting the offer sends `{ intent: 'improve', solutionId }`, and the response's `proposedContent` is shown as a diff against the current version. Accepting it creates version *n+1* through the path that already exists and is already tested.

Nothing about the workspace's data model needs to change to support this. `Solution`, `SolutionVersion` and `SolutionRun` already carry everything the collaborator needs as context: what the tool is, what problem it solves, how often it is used, how it has changed, and what the learner noted about it.

---

## 10. Acceptance criteria for the eventual implementation

1. `grep -ri "anthropic\|openai\|gemini\|claude\|gpt" apps/lao-web/src` returns nothing.
2. Adding a fourth provider touches exactly one new file plus a registry entry.
3. A contract test suite runs unmodified against every adapter, including a fake one, and passes for all.
4. Aborting a request stops token consumption, verified by usage reporting.
5. No trace record contains prompt or completion text.
6. With every provider unhealthy, the workspace degrades to a clear, vendor-free message and the learner can still edit their solution by hand.
7. A `improve` response never writes to the database on its own.

---

## 11. Explicitly out of scope

- Embeddings, retrieval, image, voice — `IProvider` covers them in principle; none are needed for the collaborator.
- Multi-agent orchestration.
- Fine-tuning.
- Letting learners choose a model. Tempting, and contrary to §1. If it is ever wanted, it belongs as an operator-level setting, not a workspace control.
