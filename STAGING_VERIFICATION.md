# Staging verification with live providers

One of the two remaining release gates. It cannot be done here, because it
needs real credentials and makes real calls. This is what to run, what a pass
looks like, and what evidence to keep.

## Before you start

The harness itself has been verified — see [Is the harness trustworthy?](#is-the-harness-trustworthy)
below. Nothing here needs debugging first.

You need one or more of:

| Provider | Environment |
|---|---|
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Gemini | `GEMINI_API_KEY` |
| Anything OpenAI-compatible (self-hosted, Together, Groq, …) | `OPENAI_COMPATIBLE_BASE_URL` + `OPENAI_COMPATIBLE_MODEL`, optionally `OPENAI_COMPATIBLE_API_KEY` |

Use a **staging key with a spend cap**, not a production one. The matrix costs
a handful of tokens per check but it does make real calls.

## Run it

```bash
npm run verify-providers --workspace=@iriskey/llm
```

It reads the same environment variables the product does, so it verifies the
real configuration rather than a parallel one. It exits non-zero if any
configured provider fails, so it can gate a release directly.

### The nine checks

| # | Check | Passes when |
|---|---|---|
| 1 | Authentication | The key works and the provider reports token usage. Nothing below is graded if this fails. |
| 2 | Streaming | Text arrives in more than one chunk. One chunk **passes with a warning** — the adapter fell back to `generate()`, which works but is not incremental. |
| 3 | Structured JSON | A requested schema comes back as valid JSON. A provider that declares no schema support is not failed for it; the router simply will not choose it for proposals. |
| 4 | Diff generation | A proposal comes back that actually differs from the original. |
| 5 | Cancellation | Aborting stops the call, as a typed `CANCELLED`. |
| 6 | Retry | The router gets an answer, and reports how many attempts it took. |
| 7 | Timeout | A deadline produces `CANCELLED` (caller gave up) or `TRANSIENT` (provider too slow). Never a hang, never another code. |
| 8 | Budget | A priced model refuses before spending. A model that declares zero cost has nothing to refuse and passes. **A priced model that ignores the limit fails.** |
| 9 | Degradation | A dead provider produces a clean typed error that does not name any vendor. |

## What a pass looks like

```
── anthropic:claude-… ────────────────────────────────────
  ✓ 1. Authentication      replied "OK", 12+2 tokens
  ✓ 2. Streaming           incremental, 14 chunks
  …
  PASS — <model id>

All configured providers passed.
```

`!` marks a pass with a warning. Warnings are repeated in a block at the end
and the closing line says "with the warnings above", so a degraded pass cannot
be filed as a clean one. **Read them before releasing.**

## Evidence to keep

Capture the full output, not a summary:

```bash
npm run verify-providers --workspace=@iriskey/llm 2>&1 \
  | tee "provider-verification-$(date +%Y-%m-%d).txt"
```

Record alongside it: the date, the staging environment, the model id for each
provider, and who ran it. A verification is about a **specific model version**
— re-run it whenever a provider is added, a model is swapped, or a vendor
changes an API.

Do not redact the model ids from the evidence. They belong in the record; they
must simply never reach a learner (check 9, and the release-candidate script,
both enforce that).

## Then re-run the release candidate

With credentials present, the clean-room run exercises the collaborator
against a real provider instead of the degraded path:

```bash
RC_DATABASE_URL='…_release_candidate' npm run verify-release-candidate
```

The collaborator step then reports *"a provider is configured and answered"*
rather than *"says plainly it cannot suggest an improvement"*, and still fails
if the reply names a provider.

## Is the harness trustworthy?

`packages/iriskey/llm/verify-harness.test.ts` drives all nine checks with
models that break precisely the thing each check exists to catch, and requires
each one to fail. A well-behaved model must pass all nine. 27 tests, run with
the ordinary suite.

Writing those tests found two checks that reported a problem in their detail
text while still reporting **PASS**:

- Streaming that was not incremental read as a pass. It is now a pass with an
  explicit warning.
- **A priced model that ignored the budget entirely returned the string
  "NOT REFUSED — budget was ignored" and passed.** A provider with no working
  spending control would have cleared the release gate. It now fails.

The leak detector behind check 9 was untestable, because check 9 builds its own
dead provider internally. It is now an exported function tested against seven
leaking messages and four clean ones.

A gate that cannot fail is not a gate.
