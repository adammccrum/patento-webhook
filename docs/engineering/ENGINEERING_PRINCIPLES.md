# Engineering principles — incident casebook

> **This document is not the standard.** The normative company standard is
> [`VERIFIED_ENGINEERING_STANDARD.md`](./VERIFIED_ENGINEERING_STANDARD.md)
> (IrisKey VES v1.0, Founder authority). Where the two differ, VES wins.
>
> This is the casebook behind it: what went wrong, in what order, and what it
> cost. Kept separate so the standard stays short enough to be read and this
> stays long enough to be convincing.

How LAO is built and how we know it works.

Every principle here was written after a defect that reached a state we had
already called verified. The incidents are kept in place deliberately: a rule
without its scar is advice, and advice gets argued with.

This document governs implementation quality, architecture, testing and
maintainability. Where it conflicts with convenience, this wins. Where it
conflicts with the brand system on a visual question, the brand system wins.

---

## 1. A system is not working because it works here

It is working when it succeeds from nothing.

Every release candidate must prove the full sequence on an empty environment:

**clean checkout → install → migrate → seed → build → run → complete learner
journey → verify cleanup**

No existing data may be required at any point. If it cannot pass from an empty
environment, it is not releasable.

> Course 1 existed in development only because an admin had once POSTed the
> seed endpoint by hand. On a fresh database the first thing a learner is
> invited to do returned 404. `prisma migrate deploy` had only ever worked
> from a shell that happened to have `DATABASE_URL` exported; from a clean
> checkout, migrations could not be run at all.

`npm run verify-release-candidate` — clones the committed HEAD, drops and
recreates the database, asserts it is empty, and runs the whole sequence.
Uncommitted changes are excluded: a release candidate is what is committed.

## 2. Three kinds of checking, because each finds what the others cannot

1. **Reading the code** finds controls that are not wired.
2. **Probing a running instance** finds handlers that are wired and still fail.
3. **Building from nothing** finds everything that only ever worked because
   someone had already done a step by hand.

A fourth was added when the first three all passed a page that crashed:

4. **Rendering the page** finds code that returns the right data and still
   cannot display it.

All four are in the pipeline. None is redundant.

> `GET /api/dashboard` returned 200 for months while `/dashboard` rendered
> "Application error: a client-side exception has occurred" — the page read
> the `{ success, data }` envelope as if it were the payload. The API was
> always correct. Nothing had ever rendered the page.

## 3. A guard that has never failed is not a guard

Before trusting any check, make it fail for the right reason, then fix the
cause and watch it pass. In that order.

1. Make the check fail.
2. Verify it fails for the correct reason.
3. Fix the defect.
4. Verify it passes.

A passing suite built on an unverified harness is not evidence.

> `InMemoryRateLimiter.check()` returned `success: true` unconditionally. The
> CI workflow installed with `pnpm --frozen-lockfile` against a repository
> with no pnpm lockfile, so every job failed at its first step — and its test
> step was `continue-on-error` regardless. The provider verification gate
> returned the string `"NOT REFUSED — budget was ignored"` and reported
> **PASS**, so a provider with no working spending control would have cleared
> a release.

Practically: a canary. Add the defect the check exists to catch, watch it be
named, remove it. Every guard in this repository has been through this.

## 4. The harness is part of the product

When a harness defect is found:

1. Fix the harness.
2. Prove the harness now fails correctly.
3. Re-run the product.
4. Never accept a green run from an unverified harness.

Harness defects are more dangerous than product defects because they produce a
confident wrong answer rather than an obvious crash.

> A harness measured pages before they finished loading. "Loading..." is a
> centred div with no overflow, no controls and no text, so it passed every
> check while the page rendered an error a moment later. A killed
> `npm run start` left `next-server` alive, and the next run probed the
> *previous build* and reported a bug that had already been fixed. `ss`
> reports no listeners at all in this sandbox and produced a confident,
> wrong "port is free".

Verify by the thing itself — an HTTP probe, not a process listing.

## 5. Nothing is complete without objective evidence

Not a recollection, not a summary. A command someone else can run.

`BETA_READY.md` carries one line of evidence per release criterion. Where a
criterion has no evidence it is recorded as unevidenced with the reason, not
omitted and not estimated.

> That document twice overstated readiness: it claimed the learner journey
> worked end to end before that had ever been tested on a fresh database, and
> its own criterion count was written by hand and wrong. Both are corrected in
> place. The goal is not to be right the first time; it is that the final
> record is correct.

Corollary: **do not simulate production where production verification is
required.** With no credentials, `verify-providers` refuses and exits non-zero
rather than pretending.

## 6. Every interactive control does exactly one of three things

**Works. Disabled with a visible reason. Does not exist.**

Nothing may look clickable and do nothing. A beautiful button that does
nothing is a defect.

Prefer fewer reliable features over more unreliable ones.

> Settings offered six controls, four of which lied: a dark-mode toggle whose
> class was never applied, a two-factor toggle with no two-factor anywhere, a
> language selector offering 中文 and العربية with no i18n, and two email
> notification toggles that were not columns — which made every save return
> HTTP 500. It now has two controls, both of which work.

## 7. Not everything is binary

**PASS**, **PASS WITH WARNING**, and **FAIL** are three different states.
Collapsing the middle one loses information in both directions: it either
fails something acceptable or hides something that matters.

> Streaming that falls back to a single chunk still answers the learner
> correctly; the experience is degraded. That is a warning. A priced provider
> that ignores its budget is uncontrolled spend. That is a failure. Both had
> been reporting PASS.

Warnings are repeated at the end of a report and named in the closing line, so
a degraded pass cannot be filed as a clean one.

## 8. A request may never depend on module import order

Initialisation that happens as a side effect of loading some *other* module is
a latent failure waiting for the first cold process.

> `initializeAudit(db)` ran when the auth module loaded.
> `/api/auth/register` does not import it. On a cold server the first
> registration returned 500 — thrown *after* the account was created, so the
> learner's retry said "already registered". The first person to use a new
> deployment could not sign up, and could not try again.

Services resolve their own dependencies lazily. Explicit initialisation stays
available for tests.

## 9. Failing to log is not a reason to fail the request

When the durable work has already succeeded, a failure in a subsequent
best-effort step must not undo it. Log it and return success.

The failure mode is often worse than the failure: an error *after* a
non-idempotent write leaves the user unable to retry.

## 10. Both sides of a boundary, tested together

A producer and a consumer can each be correct in isolation and still disagree.
`any`-typed JSON across a fetch boundary means the compiler cannot help.

Test the boundary by exercising it, not by testing each half.

> Seven client sites read `{ success, data }` as the payload. Two crashed;
> five silently carried an undefined user id. A Zod schema accepted two fields
> that were not columns. A validator rejected the empty string the form always
> sent, so nobody without an avatar could save their profile.

## 11. Roles are data. Capabilities are code

One policy engine. Every endpoint declares the capability it requires. No role
checks inside business logic, no duplicated permission checks.

`authorization-coverage.test.ts` fails the build on any route that is neither
capability-gated nor explicitly listed as public.

## 12. The learner never learns who served them

The workspace must never name Claude, GPT, Gemini, Llama, Qwen, DeepSeek,
Hermes, Mistral, or any future model. Provider independence is a product
principle, not merely a technical abstraction.

Enforced in three places: the leak detector behind provider check 9 (tested
against seven leaking messages and four clean ones), the verification matrix
itself, and a clean-room assertion that no collaborator reply names a provider.

Model ids belong in release evidence. They never reach a learner.

## 13. Documentation that has not been executed is a hypothesis

Prose is not tested by anything. A confidently-written runbook that does not
work produces a broken deployment and blames the reader.

Deployment instructions are the commands the pipeline actually runs, or they
are marked unverified.

> `DEPLOYMENT.md` described `pnpm`, `.env.local` and `db:push` — none of which
> is how this repository works — and omitted seeding entirely.

## 14. Scope discipline

- **No rewrites.** Never rewrite a file or function unless asked.
- **Smallest change at each site.** Seven envelope fixes were one line each.
- **No unrelated cleanup** while fixing a defect.
- **Ask one precise question** rather than assume, when the answer changes
  what gets built.
- **Preserve existing architecture** unless changing it is the task.

A freeze prevents scope expansion. It does not authorise knowingly shipping
avoidable defects. Defect remediation, correctness fixes and release
verification remain permitted; features, schema changes and refactors do not.

## 15. Mobile and accessibility are correctness, not polish

Every UI works on desktop, tablet and phone. Tap targets meet 24×24px
(WCAG 2.2 AA). Every `<label>` is associated with its control. Zoom is never
capped.

> The root layout declared no viewport at all, so a phone rendered at desktop
> width and scaled down — every responsive breakpoint in the codebase was
> irrelevant. Twelve labels were unassociated: a screen reader announced those
> fields as unlabelled.

---

## The pattern underneath all of it

Every defect above passed because something *adjacent* to it was tested, and
the defect itself was never exercised.

That is the whole discipline: find the thing that has never actually been run,
and run it.

---

## The guards

| Guard | Prevents |
|---|---|
| `verify-release-candidate.sh` | Anything that only works on a prepared machine |
| `verify-pages.mjs` | Pages that return 200 and cannot render |
| `verify-mobile.mjs` | Overflow, off-screen controls, small tap targets, missing viewport |
| `dead-controls.test.ts` | Controls that look clickable and do nothing |
| `form-accessibility.test.ts` | Orphaned labels, dangling `htmlFor` |
| `cold-start.test.ts` | Import-order dependencies |
| `authorization-coverage.test.ts` | Routes with no declared capability |
| `verify-harness.test.ts` | A provider gate that cannot fail |
| `brand-conformance.test.ts` | Unapproved colours, icons, vendor names, emoji, dark surfaces |
| `engine-freeze.test.ts` | Work resuming on frozen code |
| `solution-lifecycle.test.ts` | Silent failures in solution operations |
| `collaborator.test.ts` | Voice, context and intent regressions |

All run on every push via `.github/workflows/release-candidate.yml`.
