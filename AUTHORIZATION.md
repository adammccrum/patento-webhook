# Authorization

One policy engine. Every endpoint declares the capability it requires. No route, service or component checks a role directly.

---

## The shape of it

```
Request
   │
   ▼
withCapability('metrics.read', handler)      ← the endpoint declares what it needs
   │
   ▼
getPrincipal()                                ← session → user → roles (app knows sessions)
   │
   ▼
policy engine  can(principal, capability)     ← the only place that decides
   │
   ├── no principal   → 401
   ├── lacks capability → 403
   └── allowed        → handler runs, never sees an unauthorised caller
```

**Roles are data. Capabilities are code.**

Who holds a role lives in the database, so access can be granted without a deploy. What a role *means* lives in `packages/iriskey/authz/src/capabilities.ts`, so it can only change under review, and it cannot drift between environments.

---

## Roles

| Role | Purpose |
|---|---|
| `learner` | Implicit. Every authenticated user holds it; no database row needed. |
| `coach` | Learner capabilities plus `coach.read` — may read a learner's solutions to help. |
| `support` | Learner capabilities plus `support.read` — may look, not act as. |
| `enterprise` | Learner capabilities plus `tenant.manage`. |
| `admin` | May seed content and run backfills. **Cannot** read company metrics. |
| `founder` | Everything, including `metrics.read`. |

`admin` and `founder` are separated deliberately: operating the platform and reading the company's numbers are different jobs.

## Granting a role

```bash
npm run grant-role --workspace=@iriskey/database -- --email someone@example.com --role founder
npm run grant-role --workspace=@iriskey/database -- --email someone@example.com --role founder --revoke
npm run grant-role --workspace=@iriskey/database -- --list
```

Deliberately a script rather than an endpoint: granting `founder` should require access to the deployment, not merely a session.

**A fresh install has no role rows at all.** Everyone is a learner and the founder dashboards are closed until someone is granted `founder`.

---

## Writing a route

Most routes:

```ts
import { withCapability } from '@/lib/authorization';

export const GET = withCapability('solution.read', async (request, { principal }) => {
  // principal is guaranteed present and permitted
});
```

Routes already wrapped in `withErrorHandler` (which supplies its own request context):

```ts
export const GET = withErrorHandler(async (request, ctx) => {
  const principal = await requireCapability('account.read');
});
```

Both go through the same engine. `AuthorizationError` carries the messages `withErrorHandler` already maps to 401/403.

### Ownership

Holding `solution.write` means *"may write your own solutions"*. Reaching another user's resource additionally requires an elevated capability:

```ts
if (!solution || !canAccessResourceOf(principal, solution.userId)) {
  return NextResponse.json({ error: 'Solution not found' }, { status: 404 });
}
```

Ownership is a policy question, asked in one place, so support and coach elevation works everywhere at once. Note the **404, not 403** — a stranger should not learn that a resource exists.

### Public routes

A handful of routes are reachable without a capability: health probes, the auth flows, and shared solution pages. Each carries a `// PUBLIC ROUTE` comment and an entry in the allowlist inside `authorization-coverage.test.ts`.

---

## Why this cannot rot

`apps/lao-web/src/lib/__tests__/authorization-coverage.test.ts` fails the build if:

- any route declares no capability and is not on the public allowlist,
- a route names a capability that does not exist,
- a route inspects `principal.roles` or compares a role name directly,
- the public allowlist names a route that no longer exists.

This was verified by adding an ungated canary route and confirming the suite fails with a message naming the offending file.

`packages/iriskey/authz/authz.test.ts` covers the engine itself: unknown role names are ignored rather than trusted, absent principals are denied every capability, and `admin` cannot read metrics.

---

## Adding a capability

1. Add it to `CAPABILITIES` in `packages/iriskey/authz/src/capabilities.ts`.
2. Grant it to the roles that should hold it in `ROLE_CAPABILITIES`.
3. Declare it on the route.

Three steps, all in a diff a reviewer can read. `user.impersonate` exists in the vocabulary and is held by no role — so granting it later has to be a deliberate, visible act.
