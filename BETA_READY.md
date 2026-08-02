# Beta readiness

**If someone asks why we believe LAO is ready for beta, where is the proof?**

One line of evidence per criterion. Where the evidence is a command, the
command is here so anyone can re-run it.

**Status: not yet. 4 criteria of 31 lack evidence.** Two are operational and
may not be simulated; two are unverified quality requirements.

| | |
|---|---|
| Last full clean-room run | commit `285e154`, 2026-08-02, verdict **NOT RELEASABLE — 1 gate failed**, 29 steps passed |
| Blocking (operational) | official master logo; live provider credentials |
| Blocking (unverified) | mobile layout; form accessibility |
| Everything else | evidenced below |

---

## Release criteria

### 1. Build and deploy

| # | Criterion | Evidence |
|---|---|---|
| 1.1 | Builds from a clean clone | Clean-room step 2–8: `npm install` then `turbo run build` on a fresh clone of the committed HEAD. Release report row "production build succeeded". |
| 1.2 | Type-checks with no errors | `npx turbo run type-check` — 17/17 packages, clean. Run inside the clean room, not just locally. |
| 1.3 | Migrations apply to an empty database | Clean-room step 4: `npm run db:deploy` against a database dropped and recreated with 0 tables → 33 tables. |
| 1.4 | Content exists without manual intervention | Clean-room step 5: `npm run seed` creates Course 1 with 5 missions; a second run reports `already present`, proving idempotence. Found because the first clean-room run returned 404 at step 4. |
| 1.5 | Deployment documentation matches reality | `DEPLOYMENT.md` Quick Start is the five commands the clean room actually runs. The previously-documented `pnpm`/`db:push` route is marked unverified. |
| 1.6 | A release never depends on memory | `.github/workflows/release-candidate.yml` runs the whole pipeline on every push. Replaced a workflow that installed with `pnpm --frozen-lockfile` against a repo with no pnpm lockfile, so it had never run. |

### 2. The learner journey

| # | Criterion | Evidence |
|---|---|---|
| 2.1 | Complete journey works end to end | Clean-room step 10, 17 assertions: register 201 → sign in → dashboard → course (5 missions) → mission → complete → toolbox → solution → collaborator → record use → export → delete. All 200. |
| 2.2 | …with no intervention | The journey runs against a database created from nothing, in the same script, with no admin action anywhere. |
| 2.3 | No dead controls | `DEAD_CONTROL_AUDIT.md` — 66 buttons, 55 links, 5 selects, 10 forms, 2 keyboard handlers across 24 pages. Enforced by `dead-controls.test.ts`, proved to catch regressions with a canary page. |
| 2.4 | First registration works on a cold server | Clean-room step 10 row "register → 201". Previously 500 — an import-order dependency on the audit service, thrown *after* the account was created, so the retry said "already registered". Guarded by `cold-start.test.ts`. |
| 2.5 | Account deletion removes everything | Clean-room queries the database directly after the DELETE: user rows 0, solution rows 0. Not the API's word for it. |

### 3. Security

| # | Criterion | Evidence |
|---|---|---|
| 3.1 | One authorization policy engine | `packages/iriskey/authz` — capabilities in code, roles as data. `AUTHORIZATION.md`. |
| 3.2 | Every endpoint declares a capability | `authorization-coverage.test.ts` fails the build on any route that is neither capability-gated nor explicitly listed public. |
| 3.3 | Security headers are actually sent | `middleware.ts` applies `withSecurityHeaders()` to every response. It had been imported and never called; the app shipped with no CSP, HSTS or X-Frame-Options. Verified over HTTP against a running build. |
| 3.4 | Rate limiting works | `InMemoryRateLimiter.check()` returned `success: true` unconditionally and ignored `maxRequests`. Fixed; verified live returning 429 on the 4th attempt. |
| 3.5 | Password policy | `src/lib/password.ts` — 12 character minimum, common-password and sequence rejection, checked against the email. |
| 3.6 | No secrets in the repository | Clean-room step 1 fails if the clone contains `apps/lao-web/.env`. |

### 4. Privacy and data rights

| # | Criterion | Evidence |
|---|---|---|
| 4.1 | Export everything we hold (GDPR Art. 15) | `GET /api/account/export`. Clean room asserts the export contains the solution by name, with its content, version history and usage history. |
| 4.2 | Delete everything (Art. 17) | `DELETE /api/account`, typed-email confirmation, cascades verified by direct SQL. |
| 4.3 | Policies readable before signing up | `/privacy`, `/terms`, `/cookies` are deliberately public in `middleware.ts` — a learner must be able to read them before registering and after signing out. |

### 5. The collaborator

| # | Criterion | Evidence |
|---|---|---|
| 5.1 | Provider independence | `namesAProvider()` in `verify.ts`, tested against 7 leaking messages and 4 clean ones. Enforced twice more: verification check 9, and a clean-room assertion that the reply names no provider. |
| 5.2 | Degrades honestly with no provider | Clean-room row "collaborator → 200, says plainly it cannot suggest an improvement". Answers, does not fail, does not invent a proposal. |
| 5.3 | Remembers the solution | `buildContextBrief()` in `src/lib/collaborator.ts`; covered by `collaborator.test.ts`. |
| 5.4 | Provider verification harness is trustworthy | `verify-harness.test.ts`, 27 tests: every check driven with a model that breaks what it exists to catch. Found that a priced provider ignoring the budget reported **PASS**. |

### 6. Reliability and performance

| # | Criterion | Evidence |
|---|---|---|
| 6.1 | Health checks are real | `src/lib/health.ts` runs `SELECT 1`. Clean-room step 9 requires `/api/health` to report the database reachable before the journey starts. |
| 6.2 | Performance measured on a realistic corpus | 54 users / 8,601 solutions / 2,157 versions / 10,215 runs. Dashboard 2.7ms, toolbox 1.7ms, collaborator context 1.6ms p50. `PRIVATE_BETA_READINESS_REVIEW.md`. |
| 6.3 | Known ceilings are named, not hidden | Search degrades 1.7ms → 105ms between 12 and 2,000 solutions (ILIKE filters all heap rows after the userId index); toolbox payload is unbounded at 623 KB. Both recorded; neither reachable at beta scale. |

### 7. Not yet evidenced

| # | Criterion | What is missing |
|---|---|---|
| **7.1** | **Brand conformance with official assets** | The master logo has not been supplied. `brand-conformance.test.ts` fails deliberately: *"The master logo is missing from /brand/logo/."* This is the 1 failing test in every run. It must not be satisfied by recreating, redrawing, vectorising or colour-matching the logo. |
| **7.2** | **Provider verification in staging with live credentials** | No credentials. `npm run verify-providers` refuses and exits 1 rather than pretending. Runbook: `STAGING_VERIFICATION.md`. |
| **7.3** | **Works on mobile** | **Nothing verifies this.** The clean room tests HTTP status codes and payloads; it never renders a page. No viewport testing exists anywhere in the pipeline. Learners in a closed beta will open LAO on a phone. |
| **7.4** | **Forms are accessible** | 21 `<label>` elements, 2 with `htmlFor`. Screen readers cannot associate the remaining 19 with their inputs. Recorded as H5 in `PRIVATE_BETA_READINESS_REVIEW.md` and never closed. |

---

## Why the current run says NOT RELEASABLE

The clean room stops nothing else: every other step passes. The single failure
is 7.1 above.

```
| Verdict | NOT RELEASABLE — 1 gate(s) failed |
| Tests   | FAIL | 1 failed, 24 skipped, 102 passed :: Brand system is present › the master logo is committed |
```

That is the correct state. A red pipeline with a named reason is worth more
than a green one with an asterisk.

## What closes it

1. **Commit the master logo** to `brand/logo/`, unchanged. Then: remove the
   expected-failure assertion, resample the palette from the file rather than
   by eye, and freeze `/brand`. 24 currently-skipped brand tests become live.
2. **Add staging credentials** and run `npm run verify-providers`. Archive the
   output with timestamp, commit, environment, provider, model id and
   operator — the header now prints all six. Then re-run the clean room so the
   collaborator is exercised against a real provider rather than the degraded
   path.
3. **Verify mobile** on real viewport sizes, and **associate the 19 orphaned
   labels**. Neither is a feature; both are quality defects against a standing
   requirement. Awaiting a decision on whether they are closed during the
   freeze or logged for V1.1.

When all four rows have evidence, every criterion here does, and we release.

## Reproducing all of it

```bash
npm ci
npx turbo run type-check
npx turbo run test
RC_DATABASE_URL='postgresql://…/lao_release_candidate' npm run verify-release-candidate
npm run verify-providers --workspace=@iriskey/llm    # needs credentials
```

Or push, and read the release report artifact.

---

*Nothing in this document is asserted from memory. Every row was produced by a
command that can be run again.*
