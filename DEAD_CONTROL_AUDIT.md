# Dead Control Audit

**Date:** 2026-08-01
**Rule:** every interactive control must do exactly one of three things — **work**, be **disabled with a clear explanation**, or **not exist**. Nothing may look clickable and do nothing.
**Scope:** every button, link, menu item, setting, toggle, select and keyboard shortcut in `apps/lao-web`.

Three dead controls had already been found by hand. That suggested a pattern rather than isolated defects, so this is a complete pass with an automated guard behind it.

---

## Method

Enumerated across all 24 pages: 66 `<button>`, 55 `<Link>`, 16 `<input>`, 11 `<textarea>`, 5 `<select>`, 2 keyboard handlers, 10 form submissions.

Each was checked for: a handler or submit type; a link target that resolves to a real route; a stored value that something actually reads; and — for anything that writes — whether the request **actually succeeds**, tested against a running production build with a real session.

That last check is what found the two most serious defects. They were invisible to inspection because the handlers looked correct.

The whole journey was then repeated against a **database created from nothing** — migrate, seed, sign up, work through to deleting the account. That pass found a third defect that neither reading the code nor exercising the existing instance could have surfaced (D11).

---

## Findings

### Broken — looked like they worked, returned errors

| # | Control | What happened | Cause |
|---|---|---|---|
| D1 | **Save Settings** | **HTTP 500** on every save | The form sent `emailOnLogin` and `emailOnSecurityAlert`. Both were in the Zod schema but are **not columns** on `Settings`, so Prisma rejected the update. |
| D2 | **Save Profile** | **HTTP 400 "Invalid url"** for most learners | `avatar: z.string().url()` rejects `''`, and the form always sends it. Anyone who had not set an avatar — i.e. everyone new — could not save their profile at all. |

Both are now fixed and verified returning 200.

### Dead — clickable, did nothing

| # | Control | Disposition |
|---|---|---|
| D3 | **Purchase Credits** (credits) | **Removed.** No payment system exists. Replaced with the truth: nothing to buy during beta, tell us if you run out. |
| D4 | **Delete Account** (settings) | **Now works.** Wired to `DELETE /api/account` with typed email confirmation. |
| D5 | **Dark Mode toggle** (settings) | **Removed.** The `dark` class was never applied. Dark is not part of the brand identity. |
| D6 | **Two-factor toggle** (settings) | **Removed.** Persisted a flag nothing reads; no 2FA exists anywhere. |
| D7 | **Email notification toggles** ×2 (settings) | **Removed.** No notification emails are sent, and these were also the cause of D1. |
| D8 | **Language selector** (profile) | **Removed.** Offered seven languages including 中文 and العربية. There is no i18n; the stored value is never read. Actively misleading rather than merely inert. |
| D9 | **Timezone selector** (profile) | **Removed.** Never applied — all dates render with `toLocaleDateString()` in the browser locale. |
| D10 | **Archived solutions** | **Fixed earlier.** Archiving hid a solution with no way to reach it again. |
| D11 | **"Start Course 1" / any link into `/course/1`** | **Now works on a fresh deployment.** See below — this was dead on every new database, and only looked alive because this one had been seeded by hand. |

Columns for D5, D6, D8 and D9 are retained for database compatibility, per the standing instruction on deprecation.

### Correct — no action needed

| Control class | Finding |
|---|---|
| 55 internal links | All resolve to real routes. Verified by test. |
| 12 disabled states | All transient (`saving`, `loading`, empty input) and self-explanatory. |
| 2 keyboard shortcuts | Both Enter-to-send, both work. |
| 3 remaining selects | Toolbox area filter and sort, and the new-solution area picker — all read and applied. |
| 10 form submissions | All reach a real endpoint. |

---

## The one the audit nearly missed: D11

After the controls above were fixed I ran the complete learner journey against a **fresh database** rather than the working one, because the release criterion is *"works end-to-end without intervention"* and the working database had been intervened with.

Step 4 returned **404**.

The cause is not a broken link. Every route existed and every handler was wired — the audit's four structural checks passed, and would have gone on passing. The course simply **was not there**. Course 1 existed only because an admin had once POSTed `/api/admin/seed-course-1` by hand, months ago, in this environment. On any new deployment the first thing a learner is invited to do leads nowhere.

Two things were wrong underneath it:

1. There was no seed step in the deploy path at all. Content creation lived inside an authenticated admin endpoint, so it could only ever be triggered by a human who knew it existed.
2. `npm run seed --workspace=@iriskey/database` pointed at `src/seed.ts`, which **did not exist**. The script had been in `package.json` long enough to look real.

### What was done

- `packages/iriskey/database/src/seed-data.ts` — Course 1 and its five missions, extracted from the admin route so there is one definition rather than two.
- `packages/iriskey/database/src/seed.ts` — idempotent seeder. Creates Course 1 if absent, repairs the slug on a row that predates slugs, otherwise does nothing.
- `apps/lao-web/src/app/api/admin/seed-course-1/route.ts` — now imports the same `COURSE_1`. The admin endpoint remains, for re-seeding, but is no longer the only way content can arrive.

Verified on a database created from nothing:

```
=== fresh deploy: migrate then seed ===
All migrations have been successfully applied.
Course 1: created with 5 missions
=== idempotent? run again ===
Course 1: already present (5 missions)
```

The full journey was then re-run on that database and returned 200 at every step: register → sign in → dashboard → course (5 missions) → open mission → complete mission → open solution → collaborator → record use → export data → delete account. No manual step anywhere.

### Why this belongs in a dead control audit

D11 is the same defect as D5 and D8 wearing different clothes. A learner clicks something presented as the obvious next action and nothing usable happens. That it failed in the database rather than in the handler makes no difference to them.

It also marks the limit of the guard below. Static analysis checks the *code*; live probing checks the *running instance*; only a **fresh** instance checks the thing a first learner will actually meet. All three were needed, and the third found the worst one.

---

## What settings and profile look like now

Only what works:

- **Profile** — name, bio, avatar. All saved and read back.
- **Settings** — export your data, delete your account, and one honest panel explaining that notification and security settings do not exist yet and will appear when they do.

A settings page with two working controls is better than one with six, four of which lie.

---

## The guard

`apps/lao-web/src/lib/__tests__/dead-controls.test.ts` fails the build on:

1. A `<button>` with no `onClick`, no `type="submit"`, and no wrapping `<Link>`.
2. Any event handler that is an empty function.
3. "Coming soon" / "not yet available" / "TODO" on a rendered control.
4. An internal `href` pointing at a route that does not exist.
5. Re-introduction of any specific control removed above.

**Verified to catch regressions**: a canary page containing an action-less button, an empty handler, a broken link and a "Coming soon" string was added, and all four checks failed and named it. The canary was then removed.

### What it cannot catch

It checks that a control is *wired*, not that it is *useful*, and it knows nothing about data. D1 and D2 both had correct-looking handlers and still failed at the API. D11 had a correct handler, a correct route, and a correct link, and still led to a 404 because the content did not exist.

**The lesson worth keeping: a control is not verified until someone has clicked it on a server that was built from nothing.** Static analysis passes all three. Live probing on a database that has been worked on passes D11.

---

## Release criteria status

| Criterion | State |
|---|---|
| All automated tests pass | ⚠️ 122 pass, 1 fails by design (awaiting the master logo) |
| Brand conformance passes with official assets | ⏳ Awaiting logo files |
| Provider verification in staging with live credentials | ⏳ Operational — harness ready |
| **No dead controls remain** | ✅ **This audit** |
| Complete learner journey works end-to-end **without intervention** | ✅ Verified — but only after D11. On a fresh database this **failed at step 4** until the seed script existed. It now passes with no manual step. |

The fifth row is the one worth reading twice. It was written as passing before it had been tested the way it is worded, on a database that had been seeded by hand long ago. Recording that is the point: the claim is now true, and it was not true when it was first made.
