# IrisKey Core — FROZEN

**Status:** Frozen by CTO decision, 2026-08-01.
**Formerly:** `lao-engine`. Treat this package as **IrisKey Core**, an internal platform project.

---

## What "frozen" means

| | |
|---|---|
| **Do not develop** | No new features, no refactors, no speculative integration. |
| **Do not delete** | The domain model and its 111 tests are a real asset. They stay. |
| **Do not import from LAO** | `apps/lao-web` must not depend on this package. |
| **Do keep it green** | The test suite runs in CI. If it breaks, fix the break — that is maintenance, not development. |

## Why

This package contains a well-structured, event-sourced learning domain: aggregates, an event store, an event bus, a knowledge-state service, and a recommendation orchestrator. It has 111 passing tests.

It is also imported by nothing, and its only persistence is `MockRepositories` — in-memory implementations with no database behind them. Until this sprint it was not even a workspace member, so its tests had never been run.

Two credible paths existed: integrate it, or delete it. Both were rejected in favour of a third.

**Integrating it now would be speculative.** LAO does not currently have a problem that this engine solves. Building the persistence layer, wiring the event store, and migrating the product onto it would be weeks of work justified by an architecture diagram rather than by learner behaviour.

**Deleting it would be wasteful.** The domain modelling here is genuinely good and expensive to reproduce.

So it is frozen: preserved, kept compiling, kept tested, and left alone.

## When Core becomes necessary

Real learner behaviour decides, not architecture. Concrete triggers to watch for:

- LAO needs to answer *"how did this learner's understanding change over time?"* and the current row-per-solution model cannot.
- Recommendations need to consider a learner's whole history rather than one solution's usage counters.
- A second product needs the same learning model, making duplication in LAO the more expensive option.
- Auditability requires knowing *why* the system made a decision at a past point in time — which is what an event store is for.

Until one of those is a live problem with users behind it, LAO solves things directly and simply.

## Rules for LAO engineers

1. **Do not import `@lao/engine`.** A guard test in `apps/lao-web` fails if you do.
2. **Do not reimplement it here either.** If you find yourself building an event store in `apps/lao-web`, that is the signal to reconsider the freeze — raise it, do not route around it.
3. **When consuming Core eventually, take pieces.** Consume the specific capability the product needs. Do not adopt the whole engine because it is there.

## Maintenance

- `npm test --workspace=@lao/engine` must stay green.
- Dependency and security updates are in scope.
- Anything that changes behaviour is not.
