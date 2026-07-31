# LAO Intelligence Engine

Core learning platform foundation. Domain-driven, event-sourced, multi-tenant.

## Phase 1: Foundation (Complete)

✅ **Event Infrastructure**
- Immutable, versioned domain events
- Event bus (pub/sub)
- Event store (append-only log)
- Event catalog (known types registry)
- Full audit trail and replay capability

✅ **Core Domain Types**
- Learner (identity, preferences, activity)
- Goal (SMART goal definitions)
- Mission (learnable units)
- MissionProgress (learner advancement)

✅ **Repository Layer**
- Generic repository interface
- Domain-specific repository contracts
- Mock implementations for testing
- Database-agnostic design

✅ **Service Interfaces**
- LearnerService (identity, preferences)
- GoalService (goals, progress tracking)
- MissionService (mission catalog, queries)
- ProgressService (aggregation, velocity)
- LearningPathService (sequencing)
- RecommendationEngine (mission ranking)
- AchievementService (gamification)
- AssessmentService (grading)

✅ **Testing Framework**
- 100+ comprehensive unit tests
- Event infrastructure tests
- Domain validation tests
- Repository contract tests
- Immutability verification

## Architecture Principles

**Immutability**: Domain types are immutable; all changes return new instances.

**Event Sourcing**: Complete audit trail via immutable events; state can be rebuilt.

**Provider Agnostic**: AI, storage, event bus all abstracted behind interfaces.

**Domain First**: No business logic beyond domain types and event handlers.

## Running Tests

```bash
npm install
npm run test              # Run all tests
npm run test:coverage    # Coverage report
npm run typecheck        # TypeScript validation
npm run lint             # ESLint
```

## Project Structure

```
src/
  events/              # Event infrastructure (bus, store, catalog)
  domain/              # Domain types (Learner, Goal, Mission, Progress)
  repository/          # Repository interfaces & mocks
  services/            # Service interfaces
  shared/              # Common errors, types, utilities
  index.ts             # Public API exports

__tests__/
  events/              # Event infrastructure tests
  domain/              # Domain type tests
  repository/          # Repository tests
```

## Phase 2: Services

Implement core service logic:
- LearnerService commands
- GoalService commands  
- ProgressService aggregation
- Event handlers for state mutations

No UI, no business logic beyond domain entities and their state machines.

## Phase 3: Knowledge & Assessments

Implement:
- Knowledge service (competencies, gaps)
- Assessment service (grading)
- Skill catalog
- Knowledge state tracking

## Quality Standards

- Every public interface is documented
- Every service is unit testable
- Every domain type is immutable
- No breaking changes without major version
- All events are versioned

See architecture docs for details.
