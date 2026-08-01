# Private Beta Readiness Review

**Date:** 2026-08-01
**Question:** Can we invite ten real learners?
**Answer: one blocker remains, and it needs credentials rather than code.**
Five of the six are fixed and verified against a running build.

- **B6 — provider verification.** The nine-check harness exists and is proven end
  to end, but **no live vendor has ever been called** because no API key is
  available in this environment. Run
  `npm run verify-providers --workspace=@iriskey/llm` in staging with real keys.
  Half a day, once someone has the keys.

Everything else is ready for ten learners.

**Method:** everything below was executed, not inferred. A production build was run against PostgreSQL 16 with a seeded corpus of 54 users / 8,601 solutions / 2,157 versions / 10,215 runs / 1,802 messages, served by `next start`, and probed with real HTTP requests and a real session. Where something could not be verified, it says so and says why.

---

## Verdict at a glance

| Area | State | Blockers |
|---|---|---|
| Product journey | ✅ First click fixed | ~~B1~~ |
| Security | ✅ Headers + password policy fixed | ~~B2~~, ~~B3~~ |
| Privacy | ✅ Export, deletion, policy pages | ~~B4~~ |
| Reliability | ✅ Health checks now fail correctly | ~~B5~~ |
| Performance | ✅ Fine for ten learners | — |
| AI providers | ⚠️ Harness built, needs keys | B6 |
| Observability | ❌ Cannot answer the eight questions | B7 |
| Founder dashboard | ⚠️ Four of five views read zero | R6 |

---

# BLOCKERS — must fix before the first invitation

## ~~B1. The first click is a dead end~~ — **FIXED**

> **Resolved.** `Course.slug` added; links use `/course/course-1`; the API resolves by slug, cuid or position so old `/course/1` URLs still work. Migration backfills existing rows. Verified: both URLs return the real course with 5 missions.

<details><summary>Original finding</summary>

A new learner's dashboard says *"Build your first solution → Start"*. That button, and four others, link to **`/course/1`**.

The course seeder creates the course with a generated cuid. There is no course with id `1`.

**Verified live:**
```
GET /api/courses/1            → 404 {"error":"Course not found"}
seeded course id              → cmsa4sqsb000vfjrasnevxh3o
hardcoded href="/course/1"    → 5 places (dashboard ×3, solutions, transformations)
```

A learner who signs up and clicks the primary call to action sees *Course not found*. **This alone makes a beta impossible.**

**Fix (½ day):** give Course a stable `slug` (`course-1`) or resolve by `position: 1`, and route `/course/[slug]`. Then walk the journey end to end.

</details>

## ~~B2. The app serves no security headers~~ — **FIXED**

> **Resolved.** Every response now leaves through `withSecurityHeaders`. Verified on the wire: CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`.

<details><summary>Original finding</summary>

`apps/lao-web/src/middleware.ts` imports `withSecurityHeaders` from `@iriskey/security` and **never calls it**. Every path returns a bare `NextResponse.next()`.

**Verified live** — `curl -D -` on `/auth/login` returned no `Content-Security-Policy`, no `X-Frame-Options`, no `Strict-Transport-Security`, no `X-Content-Type-Options`, no `Referrer-Policy`.

The app is clickjackable and has no CSP. The helper is written and tested; it is simply not wired in.

**Fix (½ day):** apply `withSecurityHeaders(...)` to every middleware return. Re-verify with `curl -D -`.

</details>

## ~~B3. Password policy and email delivery~~ — **FIXED** (live send unverified)

> **Resolved.** 12-character floor rejecting common passwords, repeats, sequences and the learner's own email; passphrases welcome. Provider-agnostic email transport (HTTP / SMTP / console) wired into registration and reset, with failures logged and swallowed so they cannot fail a signup or reveal whether an address exists.
> **Still unverified: live delivery.** No credentials were available.

<details><summary>Original finding</summary>

**No email transport exists anywhere in the repository.** Registration and password-reset both mint a `VerificationToken` row and then only write a log line. Nothing is ever sent.

Consequences:
- *"Registration successful. Please verify your email"* is a lie — no email arrives.
- **A learner locked out of their account cannot recover it.** With ten hand-picked learners that is a support burden, not a catastrophe, but it will happen.
- Email verification is not enforced at sign-in either, so the unverifiable state is at least not blocking.

Separately, the password policy is `z.string().min(8)` and nothing else. **Verified live: the password `"password"` was accepted and the account created (HTTP 201).**

**Fix (1 day):** wire one transactional email provider for reset only; add complexity/breach checks to the password schema. Or, for beta: disable self-service registration entirely, invite by magic link, and document it.

</details>

## ~~B4. No privacy story at all~~ — **FIXED**

> **Resolved.** `GET /api/account/export` returns every solution, version, run
> and conversation as a downloadable file. `DELETE /api/account` requires the
> learner to type their own email and cascades everything away. Privacy, terms
> and cookie pages are written in plain language and reachable signed-out.
> Verified live: export returned the full record with a `content-disposition`
> filename; deletion refused an empty body and a wrong address, then removed the
> user and their solutions — confirmed absent in the database.
>
> Also fixed a second dead control found on the way: the settings page had a
> "Delete Account" button wired to nothing.

<details><summary>Original finding</summary>

Verified absent:

| Required | Present |
|---|---|
| Privacy policy page | ❌ none |
| Cookie notice / consent | ❌ none |
| Terms page | ❌ none |
| Data export (GDPR Art. 20) | ❌ no route |
| Account deletion (Art. 17) | ❌ no route, no UI |
| Retention policy | ❌ none implemented |

There is no `/api/account/*` at all. A learner cannot leave, and cannot take their work with them.

This matters more here than for most products: **learners are told the solutions are theirs.** If they cannot export or delete them, that promise is untrue.

The schema is well positioned — `onDelete: Cascade` from `User` is already verified to remove solutions, versions, runs and conversations — so deletion is genuinely small work.

**Fix (1½ days):** `GET /api/account/export` (JSON of solutions + versions + runs + conversations), `DELETE /api/account` with a typed confirmation, and three static pages. Say plainly that conversations are stored and for how long.

</details>

## ~~B5. Health checks are frozen JSON~~ — **FIXED**

> **Resolved.** All three probes are `force-dynamic` and a real `SELECT 1` check is registered. Verified by stopping PostgreSQL mid-run: `/api/health` and `/api/ready` returned 503, `/api/alive` correctly stayed 200, and both recovered without a redeploy.

<details><summary>Original finding</summary>

`/api/health`, `/api/ready` and `/api/alive` are marked `○ (Static)` in the build output — **prerendered at build time**. No check is registered anywhere in the codebase (`registerCheck` appears zero times outside the monitoring package itself).

**Verified live:** with PostgreSQL **stopped**, all three still returned HTTP 200, `"status":"healthy"`, `"ready":true` — with byte-identical timestamps to the previous call, proving the response is frozen.

A load balancer would keep routing traffic to a completely broken instance.

**Fix (½ day):** add `export const dynamic = 'force-dynamic'` to all three, register a real `SELECT 1` database check, and return 503 when it fails. Re-verify by stopping the database.

</details>

## B6. No AI provider has ever been called — **OUTSTANDING** (harness ready)

No API key was available in this environment, so **not one live provider call has been made.** What is verified is adapter *logic* against a stubbed transport: request shaping, response parsing, error mapping, retry, fallback, cancellation, budget refusal.

What is **not** verified: whether Anthropic, OpenAI or Gemini actually accept these payloads.

The degraded path *is* verified live and behaves correctly:
```
POST /api/solutions/{id}/collaborate   → 200
"No language model is configured, so I cannot suggest an improvement yet.
 Your solution is unchanged and still yours to edit."   degraded: true
```

**Fix (1 day):** run the staging matrix in §AI Provider Validation below. Do not invite learners until at least one provider passes all nine checks.

---

# HIGH PRIORITY — fix during beta week one

## H1. Nothing is paginated

Neither the dashboard nor the toolbox has a `LIMIT`. Measured against a power user with 2,000 solutions:

```
Toolbox (no limit)   p50 = 28.2ms   → 623 KB JSON response
Dashboard (no limit) p50 = 16.3ms   → grows without bound
```

Ten beta learners will not hit this. It is here because it is a one-line fix now and a migration later.

## H2. Search is a sequential scan

```
Search, 12 solutions   p50 =   1.7ms
Search, 2,000          p50 = 105.5ms   (p95 123ms)
```

`EXPLAIN ANALYZE` confirms: the `Solution_userId_idx` bitmap scan is used, then `ILIKE` filters all 2,000 matched rows in the heap (38ms in-database).

Fine for beta. Needs a `pg_trgm` GIN index before anyone accumulates hundreds of solutions.

## H3. Rate limits are trivially bypassed

Limits key on `ctx.ipAddress`, taken from the client-controlled `x-forwarded-for` header with no trusted-proxy configuration.

**Verified live:** I hit the registration limit (429 after 3 attempts — the limiter itself works correctly), then bypassed it completely by sending a different `x-forwarded-for`.

Also: limits are in-memory, so they are per-instance. `REDIS_URL` is optional and unset.

**Fix:** trust `x-forwarded-for` only from a known proxy hop; key sensitive limits on email as well as IP.

## H4. `solutionsOpened` overstates itself

`/api/founder/collaborator` computes:
```ts
_sum: { openCount: true }, where: { lastOpenedAt: { gte: since } }
```
That sums **lifetime** opens for every solution touched in the window — not opens *within* the window. Live reading was `50,237` against 8,601 solutions.

It is a real number measuring the wrong thing, which is worse than no number. Either rename it *"lifetime opens of recently-used solutions"* or count `SolutionRun`-style open events.

## H5. Forms are not accessible

- **21 `<label>` elements, 2 `htmlFor` attributes.** Nineteen labels are not programmatically associated with their inputs.
- **32 inputs/textareas/selects, 0 `aria-label`.**

A screen-reader user cannot reliably tell what any field is for.

Good already: `lang="en"`, semantic `<main>`/`<nav>`/`<h1>` throughout, and 26 visible focus styles.

**Fix (½ day):** add `id`/`htmlFor` pairs. Mechanical.

## H6. Logs cannot answer the eight questions

30 API routes use bare `console.error('Error in X:', error)`. The structured logger is used in **2** places.

A collaborator failure logs no learner id, no solution id, no intent, no provider, no model, no request id.

| Question | Answerable today |
|---|---|
| What happened? | Partly — free-text message |
| When? | ✅ |
| Which learner? | ❌ |
| Which solution? | ❌ |
| Which provider? | ❌ |
| Which model? | Only on **success** (`SolutionMessage.servedByModel`) |
| Which version? | ❌ |
| Why did it fail? | ❌ — error taxonomy is discarded before logging |

**Fix (1 day):** one `logCollaboratorEvent` helper emitting `{ requestId, userId, solutionId, version, intent, modelId, vendor, errorCode, durationMs, inputTokens, outputTokens }`. Never log prompt or completion text — that rule is already in the specification and must survive this change.

---

# What is genuinely solid

Verified working, live, under adversarial probing:

- **Authorization holds.** Unauthenticated requests to `/api/dashboard`, `/api/solutions`, `/api/founder/*`, `/api/profile`, `/api/credits` all returned **401**. A second registered learner attempting Beta One's solution got **404** on read, run, collaborate, share and duplicate — correctly refusing to confirm the resource exists — and **403** on the founder metrics.
- **Rate limiting genuinely blocks.** 3 attempts allowed, 4th returned 429 with `RATE_LIMIT_EXCEEDED`. (The limiter is correct; only its key is weak — H3.)
- **Input validation works.** Zod rejected a short name with a specific message before touching the database.
- **Auth cookies** are `HttpOnly; SameSite=Lax`, and NextAuth's CSRF token flow is active on auth routes. SameSite=Lax covers cross-site POST for the rest.
- **Migrations are clean.** `migrate deploy` on an empty database succeeds; `migrate diff` then reports *"This is an empty migration"* — no drift.
- **Backup and restore are lossless.** `pg_dump -Fc` → 1.7 MB in 0.36s; `pg_restore` into a fresh database in 1.4s; all five table counts matched exactly (54 / 8,601 / 2,157 / 10,215 / 1,802).
- **Performance is a non-issue at beta scale.** With 12 solutions per learner: dashboard 2.7ms, toolbox 1.7ms, solution open 1.9ms, version history 0.7ms, collaborator context prep 1.6ms, founder metrics 5.9ms, principal resolution 0.9ms — all p50.
- **The degraded collaborator path is honest.** No provider configured produces a clear sentence and leaves the solution untouched.

---

# Product review

## The first thirty minutes

1. Register → **works** (201).
2. *"Please verify your email"* → **dead end**, no email exists (B3).
3. Sign in → **works**; unverified accounts are permitted, which is what saves step 2.
4. Dashboard → **works**, correct empty state: *"Build your first solution"*.
5. Click **Start** → **404 Course not found** (B1). **Journey over.**

The alternate path — *New Solution* → `/solutions/new` → workspace — works end to end. Verified: created a solution (201), opened the workspace, talked to the collaborator, got an honest degraded reply.

## Empty states

Good throughout: empty toolbox, no search matches, nothing archived, and an empty conversation each render distinct, actionable copy. This was done well.

## Error recovery

- Collaborator failure returns 503 with a plain sentence and `retryable`; the solution is untouched. Good.
- Dashboard fetch failure renders bare red text with no retry button. Weak.
- Losing a session mid-action redirects to login and **discards unsaved work** in the workspace textarea. Worth a warning before beta.

## Mobile

The workspace uses only 4 responsive breakpoints. Message bubbles cap at `max-w-[42rem]` (fine), and `<pre>` blocks scroll inside `overflow-x-auto` (fine). **Not tested on a real device** — no browser automation was run. Do this manually before inviting; a phone-shaped viewport is the most likely place the two-column workspace grid breaks.

---

# AI Provider Validation — required staging matrix

**Nothing below has been executed.** This is the gate.

**The harness now exists**: `npm run verify-providers --workspace=@iriskey/llm`
runs all nine checks against whatever is configured, prints a pass/fail table,
and exits non-zero on failure so it can gate a release. It was proven end to end
against a local OpenAI-compatible server — all nine executed and passed — and
against an unreachable endpoint, where it correctly failed and skipped the rest.

Run it in staging with real keys. For each of Anthropic, OpenAI, Gemini, and one
OpenAI-compatible endpoint (Ollama or OpenRouter):

| # | Check | Pass condition |
|---|---|---|
| 1 | Authentication | Real key returns 200; bad key maps to `INVALID_REQUEST`, never retried |
| 2 | Streaming | Reports whether it is incremental. Currently a **non-incremental fallback for all providers** — the harness flags this explicitly (see R1) |
| 3 | Structured JSON | `proposedContent` returns as data, not prose |
| 4 | Diff generation | Proposal differs from current content and is applyable |
| 5 | Cancellation | Aborting stops token consumption; `CANCELLED` charges nothing further |
| 6 | Retry | Forced 429 retries same model with backoff, then succeeds |
| 7 | Timeout | Slow endpoint yields `TRANSIENT`, not a hang |
| 8 | Budget | `budgetCredits` below estimate refuses **before** the call |
| 9 | Degradation | All providers down → clear message, solution editable, no vendor name leaked |

Record which model served each check. Do not proceed to public beta until every row passes for every provider.

---

# Recommendations (non-blocking)

- **R1. Streaming is a fallback everywhere.** `stream()` calls `generate()` and yields the whole reply at once. On a slow model this reads as a hang — the single most likely thing to make the collaborator feel unresponsive. Implement real SSE for the primary provider. Contained change behind the same interface.
- **R2. No CI.** Everything verified here was verified by hand and can regress on the next commit. Highest-leverage remaining item after the blockers.
- **R3. Secrets.** `.env.example` still ships `NEXTAUTH_SECRET="your-super-secret-key-change-this-in-production"`. `SecretsValidator` exists and is never called at boot. Fail fast on a weak secret in production.
- **R4. Two-generation debt.** The goal-based flow (`/discover`, `/coach`, `/build`, `/reflection`) is still reachable by URL and measured by four founder endpoints. Beta learners will not use it. Hide the routes for beta.
- **R5. `toolkitItems` JSON** in `CourseEnrollment` still duplicates the `Solution` table.
- **R6. Founder dashboard — delete four of five views.** Verified live: `today`, `funnel`, `friction` and `weekly-transformations` all read **zero**, because the tables they query (`LearnerGoal`, `PersonalMission`, `Portfolio`, `SessionMetrics`, `AnalyticsEvent`) are empty — they measure the abandoned flow. `weekly-transformations` would report *"0 transformations this week"* while ten learners actively use the toolbox. **A metric that reads zero while the product is working is worse than no metric.** Keep only `/api/founder/collaborator` and fix H4.

---

# The exact list before inviting learners

**Done** — verified against a running production build:

| Blocker | Evidence |
|---|---|
| ~~B1~~ course dead end | `/api/courses/course-1` and `/api/courses/1` both return the real course with 5 missions |
| ~~B2~~ security headers | CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy present on the wire |
| ~~B3~~ password policy | `password`, `short1234`, `aaaa…`, `abcdefghijkl`, and own-email all rejected; passphrase accepted |
| ~~B3~~ email delivery | transport built and wired; **live send unverified — no credentials** |
| ~~B5~~ health checks | 503 with PostgreSQL stopped, 200 on recovery, `/api/alive` correctly unaffected |
| ~~B4~~ privacy | export returned the full record; deletion refused bad confirmation then removed everything, verified absent in the database; `/privacy`, `/terms`, `/cookies` reachable signed-out |

**Remaining:**

| Order | Work | Effort |
|---|---|---|
| 1 | **B6** — run `verify-providers` in staging against real keys | ½ d |
| 2 | H6 — structured collaborator logging | ½ d |
| 3 | H5 accessibility labels, H3 rate-limit keying, R6 dashboard cull, manual mobile pass | 1 d |

Then invite.

---

# One correction to the record

My previous two reports claimed verification "from a wiped `node_modules`". That was true when run, but this session began on a **stale checkout** pinned to an old commit, where a fresh `npm install` genuinely failed on `@radix-ui/react-slot@^2.0.2`. I briefly believed a fix had been lost.

It had not. The local working copy was behind; `git reset --hard origin/<branch>` restored everything, and a clean install of 967 packages then succeeded, as did type-check, tests and build. The lockfile is committed and the tree is clean.

The claims stand — but the scare is worth recording, because it is exactly the class of problem CI (R2) exists to catch, and I had no way to distinguish "my fix was lost" from "my checkout is stale" without going to the remote.

---

# On the ten learners

They are not testers. The instrumentation that matters is `/api/founder/collaborator` — opened, improved, still-in-use-at-30-days, improvements per solution — plus proposal acceptance rate, which is the honest test of whether the collaborator's advice is worth taking.

Everything else on the founder dashboard currently reports zero and should be removed before it misleads someone into a decision.
