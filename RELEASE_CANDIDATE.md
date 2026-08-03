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

Last full run: **passed**, 9 steps, from an empty database at commit `489e619`.

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

## What it found

Three defects reached a state we had called verified, because everything had
only ever been run on a machine that was already set up. Every one of them
would have been visible to the first person to use a new deployment, and none
of them was visible to us.

**Course 1 did not exist on a new deployment.** It was present in development
only because an admin had once POSTed `/api/admin/seed-course-1` by hand. On a
fresh database the first thing a learner is invited to do returned 404. There
was no seed step in the deploy path at all, and `npm run seed` pointed at a file
that had never been written. *(Found by hand, and the reason this script exists.)*

**Migrations could not be run from a clean checkout.** `prisma migrate deploy`
ran inside the database package, where there is no `.env`, and failed with
`Environment variable not found: DATABASE_URL`. It had always appeared to work
because it had always been run from a shell that happened to have the variable
exported. *(Found at step 4, on the script's first real run.)*

**The first registration on a cold server returned HTTP 500.** `initializeAudit`
runs as a side effect of loading the app's auth module, which
`/api/auth/register` does not import — so whether the audit service existed
depended on whether some earlier request had warmed a different module. In
development one always had.

The failure mode was worse than the failure: the 500 was thrown *after* the
account was created, so the learner's retry returned 409 "Email already
registered". The very first person to use a new deployment could not create an
account, and could not try again. *(Found at step 8.)*

None of these was a code bug in the ordinary sense. All three would have been
a failed launch.

## What it also found about itself

The harness had three defects of its own, and they are worth recording because
each one produced a *confident, wrong* result rather than an obvious crash.

- Backgrounding `npm run start` made npm the child and `next start` a
  grandchild, so cleanup killed the wrapper and left the server running. The
  next run's readiness probe then succeeded against the **previous build** and
  reported a bug that had already been fixed. It now starts the server with
  `exec`, refuses to start on an occupied port, and waits for the port to stop
  answering before returning.
- `ss` reports no listeners at all in this sandbox, so a manual "port is free"
  check was confidently wrong. Only the HTTP probe is trusted now.
- The response body was captured inside a command substitution, so it never
  reached the calling shell and every assertion about a body was testing an
  empty string. A response containing all five missions was reported as
  "Course returned no missions". Bodies are now read where they are used, and
  parsed as JSON by node rather than matched with regexes.

Two further failures were the harness being wrong about the product: it
expected 503 from a collaborator with no provider (the correct answer is 200
with a plain explanation and no proposed content), and it looked for an
internal solution id in the account export (which deliberately carries none —
the export is for the person, not for re-import). Both assertions were
corrected to the real contract, and the collaborator check now additionally
fails if a reply ever names a provider.

A verification harness that reports the wrong answer confidently is worse than
none. Every check here has been seen to fail for the right reason before being
trusted.

## The principle

Three kinds of checking, each finding what the previous one cannot:

1. **Reading the code** finds controls that are not wired.
2. **Probing a running instance** finds handlers that are wired and still fail.
3. **Building from nothing** finds everything that only ever worked because
   someone had already done a step by hand.

Only the third one tests what the first learner will meet.
