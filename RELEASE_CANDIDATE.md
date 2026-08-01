# Release candidate verification

A system is not working because it works here. It is working when it succeeds
from nothing.

Every release candidate must prove the full sequence from a clean state:

**clean checkout → install → migrate → seed → build → run → complete learner journey**

No existing data may be required at any point.

```bash
RC_DATABASE_URL='postgresql://user@host:5432/lao_release_candidate' \
  npm run verify-release-candidate
```

## What it actually does

| Step | Proof |
|---|---|
| Clean checkout | Clones the committed HEAD into a temp directory. Asserts no `node_modules` and no committed `.env`. |
| Install | `npm install` from nothing, including Prisma client generation. |
| Empty database | Drops and recreates the named database, then asserts **0 tables**. |
| Migrate | `npm run db:deploy` — the documented command, run the way a deployment runs it. Asserts the table count afterwards. |
| Seed | `npm run seed`, then **runs it again** and requires the second run to report `already present`. Asserts Course 1 has 5 missions. |
| Build | `turbo run type-check` and `turbo run build`. |
| Run | Starts the production server, waits for `/api/alive`, then requires `/api/health` to report the database reachable. |
| Journey | Register → sign in → dashboard → Course 1 → open a mission → complete it → open the resulting solution → collaborate → record a use → export data → delete account. Every step must return the expected HTTP status. |
| Cleanup | Queries the database directly to confirm the user **and their solutions** are gone after deletion. |

Uncommitted changes are deliberately **not** included. A release candidate is
what is committed; the script warns if the working tree is dirty and proceeds
without it.

With no provider credentials the collaborator step accepts `503` — declining
honestly is correct behaviour, and `500` is a defect. With credentials present
it requires `200`.

## Safety

The named database is **dropped**. The script refuses to run unless its name
ends in `_release_candidate` or `_rc`.

That guard was tested by pointing it at `lao_production` before it was trusted:
it refused and exited 1.

## Why this exists

Two defects reached a state we had called verified, because everything had only
ever been run on a machine that was already set up.

**Course 1 did not exist on a new deployment.** It was present in development
only because an admin had once POSTed `/api/admin/seed-course-1` by hand. On a
fresh database the first thing a learner is invited to do returned 404. There
was no seed step in the deploy path at all, and `npm run seed` pointed at a file
that had never been written.

**Migrations could not be run from a clean checkout.** `prisma migrate deploy`
ran inside the database package, where there is no `.env`, and failed with
`Environment variable not found: DATABASE_URL`. It had always appeared to work
because it had always been run from a shell that happened to have the variable
exported. This was found by this script, on its first real run, at step 4 —
which is exactly what it is for.

Neither was a code bug. Both would have been a failed launch.

## The principle

Three kinds of checking, each finding what the previous one cannot:

1. **Reading the code** finds controls that are not wired.
2. **Probing a running instance** finds handlers that are wired and still fail.
3. **Building from nothing** finds everything that only ever worked because
   someone had already done a step by hand.

Only the third one tests what the first learner will meet.
