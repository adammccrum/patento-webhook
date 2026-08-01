# The Collaborator

A teammate who knows one tool well.

The learner talks about their work — *"I've started using this every day"*, *"can we make this simpler?"* — and the collaborator answers in terms of the tool they built. It never asks them to think about prompts, models, or AI.

---

## What makes it a teammate rather than a chat box

**It already knows the tool.** Every request carries the whole picture: why the solution exists, what problem it solves, its exact current content, how many times it has actually been used and when, how much time it has saved, every revision and what changed, and the learner's own notes. The learner never re-explains themselves — not within a conversation, and not between visits weeks apart.

**The conversation belongs to the solution, not the session.** One thread per solution, stored, permanent. Coming back in a month picks up where things were left.

**Improvement is the default.** The opening move is "make this better", not "create something". Openers are phrased the way people talk about work: *Make this simpler*, *My workflow has changed*, *This isn't working right*.

**It proposes; the learner decides.** A suggested revision is shown as a diff with *Use this* and *Edit first*. Nothing is saved until the learner accepts, and accepting goes through exactly the same versioning path as a hand edit — a new version, with history intact. **The collaborator has no write access to a solution.** That is enforced in the route, not by convention.

---

## Provider independence

The workspace does not know which model answered. Neither does the collaborator service, beyond an opaque id it records for operations.

```
Workspace  ──►  Collaborator  ──►  Router  ──►  Anthropic
(no model                                   ├─► OpenAI
 vocabulary)   (owns LAO's voice)           ├─► Gemini
                                            └─► OpenAI-compatible
                                                (Ollama, vLLM, OpenRouter…
                                                 → Llama, Qwen, DeepSeek, Hermes)
```

Adding a provider is one adapter file plus one branch in the registry. Nothing in the product changes.

This is enforced by a test that walks every file under `apps/lao-web/src` and fails if any of them contains `anthropic`, `openai`, `gemini`, `claude`, `deepseek`, `qwen` or `hermes`. The single exception is `lib/llm.ts`, the sanctioned seam.

**Adapters translate; they never add.** The voice lives in one place — `lib/collaborator.ts` — so switching provider cannot change how the collaborator sounds.

### Capability honesty

Adapters declare what they can do and the router filters on it. A model that cannot enforce a JSON schema either emulates it inside the adapter or declares `supportsStructuredOutput: false` and is simply not selected for work that needs a diffable proposal. No adapter silently returns prose where structure was required.

### Failure

Errors are normalised to one taxonomy before they leave the adapter. Rate limits and transient errors retry the same model with backoff; an unavailable model falls through to the next; invalid requests and content refusals never retry, because a second attempt fails identically and costs money.

The learner sees *"The collaborator isn't available right now. Your solution is unchanged."* — never a vendor name, a status code, or raw provider text.

---

## Configuration

Set any one of these; see `.env.example`.

| Variable | For |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic |
| `OPENAI_API_KEY` | OpenAI |
| `GEMINI_API_KEY` | Google Gemini |
| `OPENAI_COMPATIBLE_BASE_URL` + `_MODEL` | Ollama, vLLM, llama.cpp, OpenRouter, Together |

**With none configured the app still runs.** The collaborator says plainly that it cannot suggest improvements yet, and the workspace stays fully usable by hand. A missing key is never a crash.

---

## The four numbers

`GET /api/founder/collaborator` (requires `metrics.read`):

1. **Solutions opened** — are people coming back to their tools?
2. **Solutions improved** — distinct solutions that gained a version.
3. **Still in use after 30 days** — with the denominator, so the rate is readable.
4. **Average improvements per solution** — is the relationship deepening?

Plus proposal acceptance rate: of the revisions the collaborator offered, how many did learners actually take. That one says whether its advice is worth anything.

---

## What is verified, and what is not

**Verified** (188 tests, no network):
- Request shaping and response parsing for all three vendor adapters, against a stubbed transport — the system prompt in the right place for each vendor, Gemini's `user`/`model` role mapping, structured output via forced tool use, schema emulation for models without it.
- Router retry, fallback, cancellation, budget refusal, and capability filtering.
- The collaborator's context brief carries usage, history and notes.
- An `explain` request cannot carry a revision, even if a model volunteers one.
- Errors never leak a vendor name.
- Conversation persistence, proposal acceptance creating a version, and cascade deletes — against a live PostgreSQL database.

**Not verified:** that a live vendor accepts these payloads. No API key was available in this environment. The adapters are built to published request/response shapes and their logic is tested, but the first real call to each provider should be made in staging before trusting it.
