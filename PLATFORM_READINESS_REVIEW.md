# Platform Readiness Review

**Date:** 2026-08-01
**Scope:** Whole repository — `apps/lao-web`, `packages/iriskey/*`, `packages/lao/ui`, `packages/lao-engine`
**Method:** Every claim below was verified by running the thing, not by reading it. Where something is unverified, it says so.

---

## 1. Current maturity

**Overall: pre-alpha, now buildable.**

Before this sprint the repository could not be installed, built, type-checked, tested, or migrated. All five now work. That is the single largest change in the platform's history, and it means the codebase is for the first time in a state where the *product* can be assessed rather than the toolchain.

| Capability | Before | Now |
|---|---|---|
| `npm install` from clean checkout | ❌ impossible | ✅ |
| `prisma generate` | ❌ schema invalid | ✅ (automatic via `postinstall`) |
| `prisma migrate deploy` | ❌ never worked | ✅ verified against PostgreSQL 16 |
| `npm run build` | ❌ syntax + type errors | ✅ 2/2 tasks |
| `turbo run type-check` | ❌ 15/15 failing | ✅ 15/15 |
| `turbo run test` | ❌ no runner existed | ✅ 8/8 tasks, 188 tests |

**Maturity by area:**

| Area | Maturity | Note |
|---|---|---|
| Solution toolbox (the product) | **Beta-ready** | Full lifecycle, 17 integration tests against a real DB |
| Course → mission → solution flow | **Alpha** | Works end to end; no automated coverage |
| Auth | **Alpha** | Functional; authorization gaps below |
| Platform packages (`@iriskey/*`) | **Mixed** | Some solid, some unused, one was silently inert |
| `lao-engine` | **Orphaned** | 111 passing tests, zero integration, no persistence |
| Analytics / founder metrics | **Non-functional** | Writes are commented out; dashboards are always empty |
| LLM collaborator | **Not started** | No provider integration exists anywhere |

---

## 2. Known blockers

Ordered by severity. The first three block public beta outright.

### B1. Admin and founder endpoints check authentication, not authorization — **critical**

`/api/admin/seed-course-1`, `/api/admin/backfill-solutions` and all five `/api/founder/*` routes check only `session?.user?.id`. Any registered user can:

- re-seed Course 1,
- run the solutions backfill,
- read company-wide metrics intended for the founder.

A `Role` model exists in the schema but no route consults it. **Not fixed in this sprint** because it requires deciding the authorization model (role names, assignment, seeding) — that is a product decision, not a mechanical fix.

### B2. Analytics are never persisted — **critical for the stated KPI**

`/api/analytics/event` logs to `console.log` and the database write is commented out (`// TODO: Persist to AnalyticsEvent table`). Meanwhile `/api/founder/funnel`, `/api/founder/friction` and `/api/founder/today` all *read* `analyticsEvent`.

Consequence: the founder dashboards that answer "Who changed their life last week?" return zeroes and always have. The metric the company says it is run by is not being collected.

### B3. No LLM provider exists — **blocks the collaborator**

There is no Anthropic/OpenAI/other client anywhere in the repository. The "coach" is a scripted `if (step === 0) … else if (step === 1) …` chain returning fixed strings. The Solution workspace's "Copy & Use" copies text to the clipboard; it does not run anything. `@iriskey/providers` defines routing and cost interfaces but has **no provider implementations**. See `LLM_PROVIDER_SPECIFICATION.md`.

### B4. No CI

No `.github/workflows`, no pipeline of any kind. Everything verified in this sprint was verified by hand and can regress silently on the next commit. Now that install/build/test/type-check all pass, this is cheap to add and high value.

### B5. Secrets are weakly defaulted

`.env.example` ships `NEXTAUTH_SECRET="your-super-secret-key-change-this-in-production"`. `@iriskey/security` has a `SecretsValidator` that would reject it, but nothing calls it at startup. A deployment that copies the example file runs with a publicly known signing secret.

---

## 3. Architectural weaknesses

### W1. `lao-engine` is a parallel universe

`packages/lao-engine` contains a well-structured event-sourced domain model — aggregates, an event store, a knowledge-state service, 111 passing tests. It is **imported by nothing**. Its only repository implementations are `MockRepositories` (in-memory); there is no database-backed repository. It was not even a workspace member until this sprint, so its tests had never run.

This is the single largest architectural liability: a substantial, tested body of domain logic that has no path to production, sitting alongside an app that reimplements simpler versions of the same concepts directly against Prisma.

**Decision needed:** integrate it, or retire it. Maintaining both is the worst option.

### W2. Two parallel learning models

The schema carries two generations of the same idea:

- **Goal-based** (older): `LearnerGoal` → `PersonalMission` → `Asset` → `Portfolio`, served by `/discover`, `/coach`, `/solution`, `/build`, `/reflection`.
- **Course-based** (current): `Course` → `Mission` → `CourseEnrollment` → `Solution`, served by `/course`, `/mission`, `/solutions`.

Nothing links from the dashboard into the older flow, but its pages and eight API routes remain live and reachable by URL. Four of them referenced `prisma.mission` after that model was renamed to `PersonalMission` and had been broken since the rename — they were fixed this sprint to make the build pass, not because the flow is wanted.

`CourseEnrollment.toolkitItems` (JSON) is now redundant with the `Solution` table; both are written on mission completion.

### W3. Session-based limits are in-memory only

`RateLimitStore` defaults to an in-memory limiter. Any multi-instance deployment gets per-instance limits, which for a 3-attempt password-reset limit across N instances means 3N attempts. Redis support exists but `REDIS_URL` is optional and unset by default.

### W4. Packages ship raw TypeScript

Every `@iriskey/*` package sets `main: src/index.ts`. This works only because the app lists all fifteen in `transpilePackages`. Any other consumer — a script, a worker, a second app — cannot import them without replicating that. There is no build step for the packages.

### W5. Two unused packages

`@iriskey/cache` and `@iriskey/queue` are imported by nothing. Both are reasonable implementations with tests; both are speculative infrastructure.

---

## 4. Performance concerns

Nothing here is currently *slow*, because there is no load. These are the places that will bend first.

- **P1. Toolbox search is unindexed.** `/api/solutions` does `contains … mode: insensitive` across `name`, `problem` and `content`. Postgres cannot use a btree index for this; it is a sequential scan per query. Fine at tens of solutions per user, poor at thousands. Needs a trigram index or `tsvector` before any user has a large toolbox.
- **P2. The list endpoint issues four queries per page load** (filtered rows, summary set, distinct areas, archived count). Correct, but chatty; the summary could be a single grouped aggregate.
- **P3. `getCollaboratorPrompt` is computed per workspace load** — trivial cost, but it reads `useCount`/`lastUsedAt` that are updated on every run, so the workspace cannot be cached.
- **P4. Backfill is O(n) sequential.** `/api/admin/backfill-solutions` awaits a `mission.findUnique` inside a nested loop. Acceptable for a one-off, unacceptable if it ever runs at scale.
- **P5. In-memory queue schedules real timers** with exponential backoff up to 60s and keeps them on the event loop. This is why the test suite needs `--forceExit`. In a serverless deployment those timers die with the invocation — jobs would silently never retry.

---

## 5. Security concerns

Beyond B1 and B5 above:

- **S1. Rate limiting was completely inert until this sprint.** `InMemoryRateLimiter.check()` hardcoded `success: true` and ignored `maxRequests` entirely, and the auth routes gated on that field. Registration and password reset had *no* effective limit. Fixed, with tests.
- **S2. Middleware protected paths that did not exist.** The list was `['/dashboard', '/settings', '/courses', '/missions']`; the real routes are `/course/[id]` and `/mission/[id]` (singular), and `/solutions`, `/profile`, `/credits` were absent. Those pages relied entirely on a client-side redirect after render. Fixed this sprint. API routes always checked the session, so data was not exposed — but authenticated-looking pages rendered to anonymous visitors.
- **S3. No rate limiting on Solution endpoints.** Create, run, duplicate and share are unlimited. `share` mints a token per call; `run` writes a row per call.
- **S4. Share tokens are 96-bit random hex** — adequate. The public `/api/shared/[shareId]` route correctly returns only published fields and never the owner, notes, or usage. Good.
- **S5. CSP allows `unsafe-inline` and `unsafe-eval`** for scripts (`@iriskey/security`, annotated "Next.js requires these"). `unsafe-eval` is generally avoidable in production Next builds.
- **S6. Ownership checks are correct and consistent** across all Solution routes — verified by test. Every mutation re-reads the row and compares `userId` before acting.

---

## 6. Developer experience issues

- **D1. Nothing worked from a clean clone** — the defining DX problem, now resolved. A new engineer previously could not install dependencies at all (`@radix-ui/react-slot@^2.0.2` does not exist; the latest is 1.3.3).
- **D2. There is no README section on running the app.** `.env.example` exists at the root but Next reads `.env` from `apps/lao-web`; an app-local example was added this sprint, but the setup steps are still undocumented.
- **D3. `npm run dev` is unverified.** `turbo run dev` is wired but requires a live database; not exercised here.
- **D4. No linting in practice.** `turbo run lint` exists and each package has an eslint script, but there is no shared config committed and `--max-warnings 0` on the app is untested.
- **D5. Test conventions differ by package** — Jest for `@iriskey/*` and the app, Vitest for `lao-engine`. Workable, but two mental models.
- **D6. Prisma is pinned to 5.7 in `package.json` but resolves to 5.22**, and a bare `npx prisma` pulls Prisma 7, which rejects this schema outright (`url` in the datasource block is no longer supported). Anyone running `npx prisma` instead of the local binary will be misled.

---

## 7. Deployment readiness

**Not ready.** A `Dockerfile` and `docker-compose.yml` exist and were not exercised in this sprint.

What works now: a clean install, a production build, and a migration path that applies to an empty database with no drift.

What is missing:

1. **No CI/CD** (B4).
2. **Migration baselining for any existing database.** The old migration history could never have been applied, so any live database was created with `prisma db push`. Such a database must be baselined once:
   `prisma migrate resolve --applied 00000000000000_init`
   Skipping this will make `migrate deploy` attempt to recreate every table.
3. **No health-check verification.** `/api/health`, `/api/ready`, `/api/alive` exist and are correctly excluded from auth middleware, but were not exercised against a running server.
4. **No secret validation at boot** (B5).
5. **Redis unconfigured**, so rate limits and cache do not survive multi-instance deployment (W3).
6. **Edge-runtime warnings** during build from `next-auth` → `jose` using Node APIs. Non-fatal today; would matter if middleware moved to edge.

---

## 8. Technical debt register

| ID | Debt | Impact | Effort |
|---|---|---|---|
| T1 | `lao-engine` unintegrated, mock-only persistence | High | Large |
| T2 | Two parallel learning models (goal-based vs course-based) | High | Medium |
| T3 | Analytics not persisted; founder dashboards empty | High | Small |
| T4 | Admin/founder routes lack role checks | High | Small |
| T5 | No CI | High | Small |
| T6 | `toolkitItems` JSON duplicates the `Solution` table | Medium | Small |
| T7 | Packages ship raw TS with no build | Medium | Medium |
| T8 | Unused `@iriskey/cache`, `@iriskey/queue` | Low | Small (delete) |
| T9 | Unindexed search | Medium | Small |
| T10 | `transformations` page ships four hard-coded stories | Medium | Small |
| T11 | Scripted coach responses masquerade as a coach | Medium | Large (needs B3) |
| T12 | In-memory queue incompatible with serverless | Medium | Medium |
| T13 | No lint config committed | Low | Small |

### Placeholder audit (Priority 3)

Full-repository scan for `TODO`, `FIXME`, `XXX`, `HACK`, `Placeholder`, `Mock`, `Temporary`, `Hardcoded`, `Fake`, `Stub`, `Example`, `Demo` across `apps/` and `packages/`, excluding `node_modules` and build output.

**Result: 5 findings. There is very little placeholder litter; the gaps are structural, not annotational.**

| Occurrence | Location | Classification | Disposition |
|---|---|---|---|
| `// TODO: Persist to AnalyticsEvent table` | `api/analytics/event/route.ts:43` | **Real gap** — the only TODO in the repository | Blocker B2 / T3 |
| `MockLearnerRepository`, `MockGoalRepository`, `MockMissionRepository`, `MockMissionProgressRepository`, `MockRepositoryFactory` | `lao-engine/src/repository/MockRepositories.ts` | **Structural** — the *only* persistence the engine has | T1 |
| `MockEventBus`, `MockEventStore` | `lao-engine/src/events/` | **Legitimate** — test doubles, correctly named, exercised by tests | Keep |
| `knowledgeRepository: any, // Placeholder for repository` | `lao-engine/src/services/KnowledgeStateService.ts:50` | **Real gap** — untyped seam awaiting a real repository | T1 |
| `// Example transformation stories - in production these come from database` | `app/transformations/page.tsx:9` | **Real gap** — four invented learner stories rendered as real | T10 |

Two further items found by behaviour rather than by keyword, and already fixed this sprint:

| Occurrence | Location | Classification | Disposition |
|---|---|---|---|
| `missionId: ''` written as a stand-in | `api/coach/init/route.ts` | Placeholder value in the database | **Fixed** — `missionId` is now nullable |
| `success: true` hardcoded regardless of limit | `@iriskey/ratelimit` | Stub behaviour presented as working | **Fixed** — limits are enforced |

---

## 9. Estimated work remaining before public beta

Assumes one engineer, and that "public beta" means real users on real data without a security incident or a broken signup.

### Must have — ~3 to 4 weeks

| Work | Estimate |
|---|---|
| Role-based authorization for admin/founder routes (B1, T4) | 3 days |
| Persist analytics; verify founder dashboards populate (B2, T3) | 2 days |
| CI: install, migrate, type-check, test, build on every PR (B4, T5) | 2 days |
| Secret validation at boot; regenerate example secrets (B5) | 1 day |
| LLM provider layer per the specification, one provider live (B3) | 5–8 days |
| Wire the collaborator into the workspace so "Improve it together" works | 3 days |
| Rate limit Solution endpoints; Redis-back limits for multi-instance (S3, W3) | 2 days |
| Deployment rehearsal: Docker, migrations, health checks, baselining | 3 days |

### Should have — ~2 weeks

| Work | Estimate |
|---|---|
| Decide and act on `lao-engine`: integrate or retire (T1) | 5 days (retire) / 3+ weeks (integrate) |
| Retire or finish the goal-based flow (T2) | 3 days |
| Replace hard-coded transformation stories with real, consented ones (T10) | 2 days |
| Drop `toolkitItems` JSON in favour of `Solution` (T6) | 1 day |
| Search indexing (T9) | 1 day |
| Automated coverage for the course → mission → solution path | 3 days |

### Realistic call

**6–8 weeks to public beta** if `lao-engine` is retired and the goal-based flow is removed.
**10–14 weeks** if `lao-engine` is integrated.

The toolbox itself — the thing the founder identified as the product — is the most solid part of the codebase and is close to beta-ready. What stands between it and users is authorization, measurement, CI, and the collaborator.

---

## 10. What changed in this sprint

For the record, so the delta is auditable:

- **Install:** fixed a non-existent dependency version; added Tailwind/PostCSS (referenced but never installed) and a missing `@iriskey/middleware` dependency.
- **Build:** added an app `tsconfig.json` (the app was pointing at a root config with no `jsx` and no DOM lib), `transpilePackages`, a `.gitignore` (there was none), and an app-local `.env.example`.
- **Syntax:** fixed unescaped apostrophes in `seed-course-1` that broke webpack outright.
- **Types:** 214 → 0 errors. Repointed four routes to `PersonalMission`, made `CoachConversation.missionId` nullable and added `goalId`, deleted the dead `/lesson` route and page (no `Lesson` model exists), and fixed genuine unchecked-index violations.
- **Tests:** 0 runnable → 188 passing. Added `turbo.json`, a Jest preset and per-package configs, added `lao-engine` to the workspaces, and stopped its `vitest` watch-mode hang. Aligned five packages' tests with actual behaviour; rewrote the queue suite against the real API.
- **Security:** made rate limiting actually enforce limits; corrected the middleware's protected-route list.
- **Migrations:** replaced a history that had never applied (no migration created the core tables; `CREATE INDEX CONCURRENTLY` cannot run in Prisma's transaction; `Mission` was created twice) with a verified baseline.
- **Solution lifecycle:** 17 integration tests against live PostgreSQL; made archived solutions reachable, exposed delete, added search/filter/sort, and made version creation transactional.
