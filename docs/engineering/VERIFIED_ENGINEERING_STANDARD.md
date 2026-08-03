# IrisKey Verified Engineering Standard (VES) v1.1

**Status:** Company Engineering Standard · self-governing
**Authority:** Founder
**Applies to:** LAO · IrisKey.ai · internal tools · AI agents · future software
products

This is the canonical copy. It is stored in the LAO repository for now because
that is where it was first derived; it is **not** LAO-specific and governs every
IrisKey project.

## Precedence

VES is the governing engineering standard for all IrisKey software projects.

- **No subsequent engineering document may contradict VES.** Where a conflict
  exists, VES takes precedence.
- All project-specific engineering documents are **implementation guides or
  casebooks derived from VES**. They may add detail, name tooling, and record
  incidents. They may not weaken, override or reinterpret a principle.
- A document that appears to conflict with VES is wrong by definition and must
  be corrected, not reconciled.

Enforced by `ves-conformance.test.ts`, which fails the build if another
engineering document claims normative authority or omits its derivation from
VES.

## VES is self-governing

The standard must always satisfy the principles it defines. It is production
software, and is subject to verification, regression protection, review,
evidence and version control like any other.

- No statement within VES may rely on assumption. Every normative statement
  must itself be supported by objective evidence.
- Every guard it references must exist.
- Every artefact it cites must exist.
- Every command it documents must execute successfully.
- Every example must remain valid.
- Every version-history entry must reference an observable change.

**A VES self-violation takes precedence over any project-level work and must be
corrected before further engineering continues.**

The objective is that confidence in VES increases over time rather than
resting on historical trust. Future engineering should not merely comply with
VES; it should continuously verify VES itself.

---

## Purpose

This document defines the engineering principles every human engineer and AI
engineer must follow.

The objective is not simply to write software. The objective is to build
software whose behaviour is **continuously verified through evidence**.

- Assumptions are not evidence.
- Passing tests are not evidence unless those tests have been proven capable of
  failing.

---

## The eight principles

Each principle below is stated first in its normative form. What follows —
*Derivation* and *Implementation* — is supporting material: the defect that
produced the rule, and how LAO currently satisfies it. The normative statement
governs. The examples are LAO's; the rule is the company's.

---

### Principle 1 — Verify the System

> Never assume a helper being correct means the application is correct.
> Always verify the running system.

**Derivation.** `withSecurityHeaders()` was imported into LAO's middleware and
never called. The application shipped with no CSP, no HSTS and no
X-Frame-Options, while a passing unit test asserted the helper produced correct
headers. A unit test proves a function is correct; it proves nothing about
whether anything calls it.

**Implementation.** Security headers asserted over HTTP against a running
production build. `dead-controls.test.ts`. The clean-room journey.

---

### Principle 2 — Verify Contracts

> Every interface between systems must have a verified contract.
> APIs. Database boundaries. Agent communication. Model outputs. Everything.

No response format may exist without an automated consumer verification. Where
possible, share types across the boundary rather than duplicate assumptions on
each side.

Two sides can each be correct in isolation and still disagree. Across a network
boundary the payload is untyped, so the compiler cannot help. This applies with
equal force to **agent-to-agent messages and model outputs**, which are less
stable than an API and are frequently trusted more.

**Derivation.** LAO's API returns `{ success, data }`. Seven client sites read
the envelope as the payload. Two crashed outright — the dashboard, the page
every learner lands on after signing in, rendered "Application error: a
client-side exception has occurred" — and five silently carried an undefined
user id. Separately, a validation schema accepted two fields that were not
database columns, making every settings save return HTTP 500.

**Implementation.** `verify-pages.mjs` fails when an envelope reaches the DOM
or a page renders without the data the API returned. Structured model output is
schema-validated at the tool-call layer, so a mismatch is retried rather than
parsed hopefully.

---

### Principle 3 — Verify From Zero

> Every release must be reproducible from: fresh clone. Empty database.
> Documented commands only.
> Nothing may rely on historical state.

**Derivation.** Course 1 existed in LAO's development environment only because
an admin had once POSTed the seed endpoint by hand. On a fresh database the
first action a learner is invited to take returned 404. Separately,
`prisma migrate deploy` had only ever worked from a shell that happened to have
`DATABASE_URL` exported — from a clean checkout, migrations could not be run at
all.

**Implementation.** `verify-release-candidate.sh` clones the committed HEAD,
drops and recreates the database, asserts it is empty, then runs install →
migrate → seed twice → type-check → test → build → run → journey → verify
cleanup. Uncommitted changes are excluded: a release candidate is what is
committed.

---

### Principle 4 — Verify Cold Start

> The first request after deployment is part of the product.
> Cold start behaviour must always be tested.

**Derivation.** LAO's audit service was initialised as a side effect of loading
the auth module. The registration route does not import it. On a cold server
the first registration returned HTTP 500 — thrown *after* the account was
created, so the learner's retry answered "email already registered". The first
person to use a new deployment could not sign up, and could not try again.

Two rules follow:

- A request may never depend on which module happened to load first. Services
  resolve their own dependencies; explicit initialisation stays available for
  tests.
- **Failing to log is not a reason to fail the request.** When the durable work
  has already succeeded, a best-effort step that fails afterwards must not undo
  it. The failure mode is often worse than the failure.

**Implementation.** `cold-start.test.ts` loads the service in an isolated
module registry with nothing else imported. The clean room's first HTTP call is
a registration against a just-started server.

---

### Principle 5 — Verify the Verifier

> Every verification tool must first demonstrate that it detects failure.
> A guard that cannot fail is not a guard.

The sequence is fixed:

1. Make the check fail.
2. Verify it fails for the correct reason.
3. Fix the defect.
4. Verify it passes.

**Derivation.** A rate limiter returned `success: true` unconditionally. A CI
workflow installed with `pnpm --frozen-lockfile` against a repository with no
pnpm lockfile, so every job failed at its first step — and its test step was
`continue-on-error` regardless. A provider verification gate returned the
string `"NOT REFUSED — budget was ignored"` and reported **PASS**, so a
provider with no working spending control would have cleared a release.

**Implementation.** Every guard in LAO has been through the four steps, and the
evidence is recorded in its commit message. In practice this means a canary:
introduce the defect the check exists to catch, watch it be named in the
output, remove it.

---

### Principle 6 — Verify Documentation

> Documentation is executable engineering.
> If documentation cannot reproduce reality, the documentation is wrong.

Operational documentation must reference re-runnable commands wherever
practical. Prose is tested by nothing; a confidently written runbook that does
not work produces a broken deployment and blames the reader.

**Derivation.** LAO's deployment guide described `pnpm`, `.env.local` and
`db:push` — none of which is how the repository works — and omitted seeding
entirely.

**Implementation.** The Quick Start is literally the commands the clean room
runs. Unverified sections are marked as such rather than deleted or trusted.
`BETA_READY.md`, `RELEASE_CANDIDATE.md` and `STAGING_VERIFICATION.md` cite
commands, not claims.

---

### Principle 7 — Verify User Behaviour

> The user journey is the product.
> Testing isolated functions is insufficient.
> Verify complete journeys against the running application.

**Derivation.** `avatar: z.string().url()` rejects the empty string, which the
form always sends, so every learner without an avatar was unable to save their
profile. Settings offered six controls, four of which lied — including a
language selector offering 中文 and العربية with no internationalisation
anywhere in the product.

Two rules follow:

- Every interactive control does exactly one of three things: **works**, is
  **disabled with a visible reason**, or **does not exist**. Nothing may look
  clickable and do nothing.
- Mobile and accessibility are correctness, not polish. Tap targets meet
  24×24px, every label is associated with its control, zoom is never capped.

**Implementation.** The clean-room journey (17 assertions). `verify-pages.mjs`.
`verify-mobile.mjs` at 375px, 320px and 768px. `dead-controls.test.ts`.
`form-accessibility.test.ts`.

---

### Principle 8 — Verify the Harness

> Testing infrastructure is production software.
> It must be engineered, reviewed and tested accordingly.

Harness defects are more dangerous than product defects, because they produce a
confident wrong answer rather than an obvious crash.

When a harness defect is found:

1. Fix the harness.
2. Prove the harness now fails correctly.
3. Re-run the product.
4. Never accept a green run from an unverified harness.

**Derivation.** A harness measured pages before they had loaded — "Loading..."
is a centred div with no overflow, no controls and no text, so it passed every
check while the page rendered an error a moment later. A killed server left its
child process running, so the next run probed the *previous build* and reported
a defect that had already been fixed. A response body captured inside a command
substitution never reached the calling shell, so every assertion about it
tested an empty string: a response containing all five missions was reported as
"Course returned no missions".

**Implementation.** Harnesses wait for a settled page and treat a crash as a
defect in its own right; they refuse to start on an occupied port and wait for
it to go quiet before returning; state is verified by the thing itself — an
HTTP probe, never a process listing. `verify-harness.test.ts` drives all nine
provider checks with models that break precisely what each one exists to catch.

---

## Engineering Rule

Every significant defect must permanently improve the engineering system.
Either:

1. **add a new guard**, or
2. **strengthen an existing guard**, or
3. **document why no guard is required**.

**The engineering process must become stronger after every failure.** A defect
is not fully resolved until recurrence prevention has been addressed. "Fixed"
is not a terminal state; "cannot recur silently" is.

### Defect resolution checklist

| Step | Requirement |
|---|---|
| 1 | State the root cause in plain language — the mechanism, not the symptom. |
| 2 | State why existing verification missed it. Which principle was not being followed? |
| 3 | Apply the smallest change that fixes it. No unrelated cleanup. |
| 4 | Add or strengthen a guard, or record why neither is appropriate. |
| 5 | Prove the guard fails on the unfixed code, then passes on the fixed code. |
| 6 | Record the evidence — a command that can be re-run, not a summary. |

Outcome 3 is legitimate, but it must be explicit and reasoned. Silence is not
outcome 3.

---

## AI Engineering Policy

Every AI engineer working on any IrisKey project must comply with this
standard. This includes:

- coding agents
- review agents
- QA agents
- planning agents
- autonomous engineering agents

**The standard applies equally to human and AI contributors.** There is no
reduced burden of evidence for work produced by a model, and no elevated trust
for it either.

Specific obligations that bear on AI contributors with particular force:

| Obligation | Why it matters here |
|---|---|
| Never report a result you have not observed | A model can produce a fluent, confident, false completion report more easily than a human can. Every claim must name the command that produced it. |
| Never mark work complete on the strength of a plausible diff | Code that looks correct is the normal output. Correctness is established by running it, not by reading it. |
| Report failures faithfully | If tests fail, say so and show the output. If a step was skipped, say which and why. A partially completed task reported as complete is the most expensive failure mode available to an agent. |
| Correct the record when you were wrong | A prior statement that turns out to be false must be corrected in the artefact, not just in conversation. The goal is not to be right the first time; it is that the final record is correct. |
| Verify your own tooling | Principle 8 applies to anything an agent writes to check its own work. An agent that trusts its own unverified harness will confidently certify a broken system. |
| Ask rather than assume | When the answer would change what gets built, one precise question beats an assumption. |

Agents operating autonomously must leave the same evidence trail a human would
be required to leave: re-runnable commands, recorded outputs, and named guards.

---

## Release Rule

Software is considered release-ready **only when supported by objective
evidence**.

The following do **not** constitute evidence:

- Assertions
- Memory
- Confidence
- Opinion
- Expectation

**Evidence must be reproducible.**

Corollaries:

- **Do not simulate production where production verification is required.**
  With no credentials, a provider gate must refuse and exit non-zero rather
  than pretend.
- **Three states, not two.** PASS, PASS WITH WARNING, FAIL. A degraded pass may
  never be filed as a clean one.
- **A red pipeline with a named reason is worth more than a green one with an
  asterisk.**
- Where a release criterion has no evidence, it is recorded as unevidenced with
  the reason — never omitted, never estimated.

---

## Company Philosophy

> We do not build software that we believe works.
> We build software that we can repeatedly prove works.

---

## Reference implementation — LAO

LAO is the first product held to this standard, and its guards are a worked
example of what compliance looks like.

Every guard below is invoked by `.github/workflows/release-candidate.yml` on
every push — asserted by `ves-conformance.test.ts`, which reads the workflow
and fails if a guard named here is not actually run. No verification step is
`continue-on-error`; the single exception is the artefact download in the
reporting job, which must tolerate a missing artefact from a job that failed
before producing one. Red means not releasable.

| Guard | Principle | Prevents |
|---|---|---|
| `verify-release-candidate.sh` | 3 | Anything that only works on a prepared machine |
| `verify-pages.mjs` | 2, 7 | Pages that return 200 and cannot render |
| `verify-mobile.mjs` | 7 | Overflow, off-screen controls, small tap targets, missing viewport |
| `cold-start.test.ts` | 4 | Import-order dependencies |
| `dead-controls.test.ts` | 1, 7 | Controls that look clickable and do nothing |
| `form-accessibility.test.ts` | 7 | Orphaned labels, dangling `htmlFor` |
| `authorization-coverage.test.ts` | 1 | Routes with no declared capability |
| `verify-harness.test.ts` | 5, 8 | A provider gate that cannot fail |
| `solution-lifecycle.test.ts` | 2 | Silent failures in solution operations |
| `collaborator.test.ts` | 2 | Voice, context and intent regressions |
| `brand-conformance.test.ts` | 6 | Unapproved colours, icons, vendor names, emoji, dark surfaces |
| `engine-freeze.test.ts` | — | Work resuming on frozen code |

Additional standing rules adopted by LAO and recommended company-wide:

| Rule | Meaning |
|---|---|
| Roles are data, capabilities are code | One policy engine; every endpoint declares its capability; no role checks in business logic. |
| Provider independence | The user never learns which model served them. Model ids belong in release evidence and nowhere else. |
| Smallest change at each site | Seven contract fixes were one line each. |

---

## Related documents

| Document | Role |
|---|---|
| `docs/engineering/ENGINEERING_PRINCIPLES.md` | Incident casebook — the narrative record of what went wrong and why. Subordinate to this standard. |
| `BETA_READY.md` | Live release criteria, one line of evidence each. |
| `RELEASE_CANDIDATE.md` | The clean-room procedure and what it has caught. |
| `STAGING_VERIFICATION.md` | Provider verification runbook and evidence requirements. |
| `DEAD_CONTROL_AUDIT.md` | The control audit and its guard. |
| `AUTHORIZATION.md` | The capability model. |

---

## Amendment process

**Future amendments to VES require explicit Founder approval.**

VES evolves through evidence, not opinion. Its authority comes from verified
engineering experience, and it loses that authority the moment a principle is
added because someone preferred it.

Every amendment must contain all four of the following. An amendment missing
any one of them is not an amendment; it is a preference.

| # | Required | Test |
|---|---|---|
| 1 | The defect or observation that motivated the change | Name it. What broke, where, and what it cost. |
| 2 | Why existing principles were insufficient | If an existing principle already covered it, the failure was compliance, not the standard. Strengthen the guard instead. |
| 3 | The permanent engineering improvement introduced | The new or strengthened guard, named. |
| 4 | The expected effect on future verification | What will now be caught that was not being caught. |

### Amendment template

```markdown
## VES vX.Y — <one-line summary>

**Motivating defect.**      <what happened, where, what it cost>
**Why VES was insufficient.** <which principle nearly covered it, and the gap>
**Improvement introduced.**  <new or strengthened guard, by name>
**Expected effect.**         <what is now caught that was not>
**Approved by.**             Founder, <date>
```

### What does not justify an amendment

- A preference, a convention, or a style opinion.
- A defect already covered by an existing principle — that is a **compliance**
  failure, and the correct response is a stronger guard under the existing
  principle, not a ninth principle.
- A hypothetical. VES records what has actually gone wrong.

**Do not allow the standard to grow through preference alone.** Eight
principles that are all enforced are worth more than twenty that are aspired
to.

---

## Version history

Each principle is recorded with the evidence that produced it, so a future
project can understand *why* it exists rather than merely complying with it.
Commit references are to the LAO repository.

### v1.1 — 2026-08-02 · Founder — VES becomes self-governing

**Motivating defect.** The first audit of VES against its own principles found
two false normative statements in the document that forbids unsupported
normative statements:

1. *"All run on every push"*, of a table listing twelve guards.
   `verify-pages.mjs` and `verify-mobile.mjs` were not in the CI workflow at
   all. The two guards covering the defect class that produced Principle 2 —
   a page returning 200 and failing to render — ran only when someone
   remembered to run them by hand.
2. *"Nothing in the pipeline is `continue-on-error`"*, while
   `release-candidate.yml` carried one at line 183, and its own header comment
   repeated the same false claim.

**Why existing principles were insufficient.** Principles 1, 5 and 6 all
applied — a claim never verified, a guard that could not fail, documentation
that did not reproduce reality — but every one of them was written to be
applied *by* the standard *to* the product. Nothing turned them back on the
standard. Compliance was assumed because the document was the thing defining
compliance.

**Improvement introduced.** VES is declared self-governing. `ves-conformance.test.ts`
grows from 11 checks to 15, adding: every cited document exists; every npm
script named exists; every guard claimed to run on every push is actually
invoked by the workflow; and no verification step is `continue-on-error`
except the artefact download that must tolerate a missing artefact. A
`rendering` job was added to CI so that the first claim became true rather
than being softened.

**Expected effect.** A false claim about the pipeline now fails the build. The
two rendering guards run on every push, closing the gap that let the dashboard
crash reach a state we had called verified. Future principles cannot cite a
guard, document, command or workflow step that does not exist.

**Approved by.** Founder, 2026-08-02.

---

### v1.0 — 2026-08-02 · Founder

Adopted from eight defect classes, each identified from a defect that had
already reached a state we called verified.

| Principle | Motivating defect | First evidence |
|---|---|---|
| 1 · Verify the System | `withSecurityHeaders()` imported and never called; the app shipped with no CSP, HSTS or X-Frame-Options while a unit test asserted the helper was correct. `npm run seed` pointed at a file that had never been written. | `855a177`, `dbc3477` |
| 2 · Verify Contracts | API returns `{ success, data }`; seven client sites read the envelope as the payload. `/dashboard` — the page every learner lands on after signing in — rendered "Application error" on every load. A validation schema accepted two fields that were not columns, making every settings save return 500. | `924ae0a`, `dbc3477` |
| 3 · Verify From Zero | Course 1 existed only because an admin had once POSTed the seed endpoint by hand; a fresh database returned 404 at the learner's first action. `prisma migrate deploy` could not run from a clean checkout at all. | `dbc3477`, `ede6410` |
| 4 · Verify Cold Start | The audit service initialised as a side effect of loading the auth module, which the registration route does not import. The first registration on a cold server returned 500 *after* creating the account, so the retry said "already registered". | `b338ce6` |
| 5 · Verify the Verifier | A rate limiter returned `success: true` unconditionally. A CI workflow installed with `pnpm --frozen-lockfile` against a repo with no pnpm lockfile and had never run. A provider gate returned `"NOT REFUSED — budget was ignored"` and reported PASS. | `f24df76`, `544c64e`, `7b0fbc6` |
| 6 · Verify Documentation | The deployment guide described `pnpm`, `.env.local` and `db:push` — none of which is how the repository works — and omitted seeding entirely. | `ede6410` |
| 7 · Verify User Behaviour | `z.string().url()` rejected the empty string the form always sends, so nobody without an avatar could save their profile. Settings offered six controls, four of which did nothing. The root layout declared no viewport, so every responsive breakpoint was irrelevant on a phone. | `dbc3477`, `9f83413` |
| 8 · Verify the Harness | A harness measured pages before they loaded and passed a page that crashed a moment later. A killed server left its child alive, so a run probed the previous build and reported an already-fixed defect. A response body captured in a command substitution never reached the calling shell, so a response containing five missions was reported as "no missions". | `1eff563`, `08d2cda`, `9f83413` |

**Supporting policies adopted at v1.0:** Engineering Rule (every significant
defect adds a guard, strengthens one, or documents why none is required); AI
Engineering Policy (the standard binds human and AI contributors equally);
Release Rule (assertions, memory, confidence, opinion and expectation are not
evidence).

---

*This standard was derived entirely from defects that reached a state already
called verified. It should grow the same way: by incident, with evidence, never
by speculation.*
