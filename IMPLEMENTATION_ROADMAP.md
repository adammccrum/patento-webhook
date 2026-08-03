# LAO Intelligence Engine — Implementation Roadmap

**Status**: Architecture Design  
**Version**: 1.0  
**Last Updated**: 2024-07-31

---

## Overview

This roadmap phases the implementation of the LAO Intelligence Engine to ensure a solid foundation before adding complexity.

Each phase is a vertical slice—it delivers end-to-end value and can be tested in isolation. Each phase builds on prior phases, never requires them to be redone.

---

## Phase 1: Foundation (Weeks 1-3)

**Goal**: Build event-driven architecture and core types.

**Deliverables**:
1. Event system (bus, store, publisher)
2. Base domain types and interfaces
3. Learner and Goal services (minimal)
4. Database schema (basic tables)
5. Testing framework

**Work**:

```typescript
// packages/lao-engine/src/events/
- DomainEvent interface
- EventBus (pub/sub)
- EventStore (persistence)
- EventRegistry (catalog)

// packages/lao-engine/src/domain/
- Learner aggregate
- Goal aggregate
- Shared value objects

// packages/lao-engine/src/shared/
- Domain errors
- Common types
- Utilities

// tests/
- Event bus tests
- Domain entity tests
- Database migration tests
```

**Success Criteria**:
- Events can be emitted and subscribed
- Events persist and can be replayed
- Core entities have proper types
- No external dependencies (mock everything)

**Testing**:
```typescript
// Can create event and store it
const event = new UserOnboardedEvent(...);
await eventStore.append(event);

// Can subscribe and receive
let received = null;
eventBus.subscribe('UserOnboarded', (event) => {
  received = event;
});
await eventBus.publish(event);
expect(received).toBeDefined();
```

---

## Phase 2: Learner & Goal Services (Weeks 4-5)

**Goal**: Implement learner management and basic goal creation.

**Deliverables**:
1. LearnerService (create, update, preferences)
2. GoalService (create, update, track progress)
3. Repositories (data access)
4. HTTP API endpoints

**Work**:

```typescript
// packages/lao-engine/src/domain/learner/
- LearnerService (queries + commands)
- LearnerRepository
- Learner state machine

// packages/lao-engine/src/domain/goal/
- GoalService
- GoalRepository
- Goal state machine

// API endpoints
- POST /api/learners (create)
- GET /api/learners/:id
- PUT /api/learners/:id/preferences
- POST /api/goals (create)
- GET /api/goals/:id
- PUT /api/goals/:id
```

**Success Criteria**:
- Can create learner (fires UserOnboardedEvent)
- Can update learner preferences (fires PreferencesUpdatedEvent)
- Can create goal (fires GoalCreatedEvent)
- All state transitions validated
- Full test coverage

**Testing**:
```typescript
it('should create learner and emit event', async () => {
  const learner = await learnerService.createLearner({
    email: 'user@example.com',
    name: 'John',
    learningStyle: 'visual',
    availableHoursPerWeek: 10
  });
  
  expect(learner.id).toBeDefined();
  expect(learner.state).toBe('onboarding');
  
  const event = await eventStore.findByType('UserOnboarded');
  expect(event.data.learnerId).toBe(learner.id);
});
```

---

## Phase 3: Knowledge Service & Assessments (Weeks 6-7)

**Goal**: Model learner knowledge and assessment capabilities.

**Deliverables**:
1. KnowledgeService (competencies, gaps)
2. AssessmentService (grading, results)
3. Skill catalog
4. Knowledge state tracking

**Work**:

```typescript
// packages/lao-engine/src/domain/knowledge/
- KnowledgeService
- KnowledgeStateRepository
- Competency model

// packages/lao-engine/src/domain/assessment/
- AssessmentService
- AssessmentRepository
- Grader interface
- SimpleGrader implementation

// packages/lao-engine/src/domain/skill/
- Skill entities
- Skill relationships (prerequisites)

// API endpoints
- GET /api/learners/:id/knowledge
- POST /api/assessments/:id/submit
- GET /api/assessments/:id/results
```

**Success Criteria**:
- Can track learner competencies
- Can submit assessment and get graded
- Knowledge gaps detected (CompetencyUpdated, GapDetected events)
- Skill prerequisites validated

**Testing**:
```typescript
it('should update competency on assessment pass', async () => {
  const assessment = await assessmentService.submitAssessment(
    learnerId,
    assessmentId,
    answers
  );
  
  expect(assessment.passed).toBe(true);
  
  // Check competency updated
  const knowledge = await knowledgeService.getKnowledgeState(learnerId);
  const skillLevel = knowledge.competencies[skillId];
  expect(skillLevel).toBeDefined();
  expect(skillLevel.level).toBeGreaterThan(0);
});
```

---

## Phase 4: Mission Service (Weeks 8-9)

**Goal**: Implement mission catalog and unlock logic.

**Deliverables**:
1. Mission Service (query, curate)
2. Lesson management
3. Mission unlock criteria
4. Progress tracking

**Work**:

```typescript
// packages/lao-engine/src/domain/mission/
- MissionService
- MissionRepository
- Lesson entities
- Unlock criteria evaluation

// packages/lao-engine/src/domain/progress/
- ProgressService (basic)
- MissionProgress tracking

// Seed data
- Create mission catalog (10+ missions)
- Define skill prerequisites
- Map missions to skills

// API endpoints
- GET /api/missions
- GET /api/missions/:id
- POST /api/missions/:id/start
- PUT /api/missions/:id/progress
```

**Success Criteria**:
- Can list missions
- Mission unlock criteria evaluated correctly
- Mission completion tracked (MissionCompleted event)
- Progress calculated accurately

**Testing**:
```typescript
it('should unlock mission when prerequisites met', async () => {
  // Mission B requires Mission A
  const learner = await learnerService.createLearner({...});
  
  // Complete Mission A
  await progressService.completeMission(learner.id, missionAId);
  
  // Check Mission B is unlocked
  const canUnlock = await missionService.canUnlockMission(
    learner.id,
    missionBId
  );
  expect(canUnlock).toBe(true);
});
```

---

## Phase 5: Recommendation Engine - Basic (Weeks 10-11)

**Goal**: Implement simple recommendation strategy.

**Deliverables**:
1. RecommendationEngine interface
2. GoalDrivenStrategy (first strategy)
3. Path generation
4. Mission ranking by relevance

**Work**:

```typescript
// packages/lao-engine/src/services/recommendation/
- RecommendationEngine
- RecommendationStrategy interface
- GoalDrivenStrategy implementation

// packages/lao-engine/src/domain/path/
- LearningPathService
- LearningPath entities
- PathRepository

// Algorithm
- Identify goal's required skills
- Find missions that teach those skills
- Rank by learner's current knowledge
- Order by difficulty (prerequisite chain)

// API endpoints
- POST /api/learners/:id/recommend
- GET /api/paths/:id
- GET /api/learners/:id/paths
```

**Success Criteria**:
- Can generate learning path for goal
- Path respects prerequisite chains
- Missions ranked by relevance
- LearningPathGenerated event emitted

**Testing**:
```typescript
it('should generate valid learning path', async () => {
  const path = await recommendationEngine.generatePath(
    learnerId,
    goalId
  );
  
  expect(path.missions.length).toBeGreaterThan(0);
  
  // Validate prerequisites
  for (let i = 0; i < path.missions.length - 1; i++) {
    const current = path.missions[i];
    const next = path.missions[i + 1];
    
    // Next mission's prereqs should be in current or earlier
    expect(hasPrerequisites(next, path.missions.slice(0, i + 1))).toBe(true);
  }
});
```

---

## Phase 6: Achievement System (Weeks 12-13)

**Goal**: Implement gamification and recognition.

**Deliverables**:
1. AchievementService
2. Achievement definitions (badges, certificates)
3. Unlock criteria evaluation
4. Credit system

**Work**:

```typescript
// packages/lao-engine/src/domain/achievement/
- AchievementService
- AchievementRepository
- Achievement definitions

// packages/lao-engine/src/domain/credits/
- CreditsService (simple ledger)

// Achievement types
- MissionCompletionBadge
- GoalCompletionCertificate
- SkillMasteryBadge
- LearningStreakMilestone
- CohortLeaderBadge (future)

// API endpoints
- GET /api/learners/:id/achievements
- GET /api/achievements/:id
```

**Success Criteria**:
- Achievements unlock on correct criteria
- Credits awarded (MissionCompleted)
- Achievement unlock event emitted
- Dashboard shows achievements

**Testing**:
```typescript
it('should award achievement on mission completion', async () => {
  await progressService.completeMission(learnerId, missionId);
  
  const achievements = await achievementService.evaluateUnlockCriteria(
    learnerId
  );
  
  // Check if mission-completion achievement exists
  expect(achievements.some(a => a.type === 'MissionCompletion')).toBe(true);
  
  // Check event was emitted
  const events = await eventStore.findByType('AchievementUnlocked');
  expect(events.length).toBeGreaterThan(0);
});
```

---

## Phase 7: AI Provider Abstraction (Weeks 14-15)

**Goal**: Integrate AI as pluggable service.

**Deliverables**:
1. AIProvider interface
2. Claude provider implementation
3. Mock provider for testing
4. AI-assisted explanations
5. Optional: AI-based essay grading

**Work**:

```typescript
// packages/lao-engine/src/services/ai/
- IAIProvider interface
- ClaudeAIProvider implementation
- MockAIProvider for testing
- AIProviderFactory

// Integration points
- Generate lesson explanations (on demand)
- Generate recommendations insights
- Score essays (alternative grader)

// API endpoints
- POST /api/learners/:id/explain/:conceptId
- POST /api/missions/:id/get-help

// Config
- selectProvider('claude' | 'openai' | 'mock')
- setProvider(provider)
```

**Success Criteria**:
- Can swap AI providers without code changes
- All AI calls go through interface
- Mock provider available for testing
- Works with existing services

**Testing**:
```typescript
it('should use mock provider in tests', async () => {
  const engine = new LAOEngine({
    aiProvider: 'mock'
  });
  
  const explanation = await engine.generateExplanation(
    learnerId,
    conceptId
  );
  
  // Mock should return predictable result
  expect(explanation).toBeDefined();
  expect(explanation.length).toBeGreaterThan(0);
});
```

---

## Phase 8: Advanced Recommendation Strategies (Weeks 16-17)

**Goal**: Support multiple recommendation approaches.

**Deliverables**:
1. SkillDrivenStrategy
2. InterestDrivenStrategy
3. PaceBased adaptation
4. Path reordering based on performance

**Work**:

```typescript
// packages/lao-engine/src/services/recommendation/
- SkillDrivenStrategy
- InterestDrivenStrategy
- AdaptiveStrategy (changes based on progress)

// Algorithms
- Skill-based: Find gaps, find missions teaching those skills
- Interest-based: Match learner's topics of interest
- Adaptive: Reorder based on velocity, comprehension

// Config
- selectRecommendationStrategy(name)
- setStrategy(learner, strategyName)

// API endpoints
- GET /api/recommendations/strategies
- PUT /api/learners/:id/recommendation-strategy
```

**Success Criteria**:
- Multiple strategies work correctly
- Engine can switch strategies per learner
- Path reorders intelligently
- LearningPathReordered event emitted

---

## Phase 9: Batch Processing & Analytics (Weeks 18-19)

**Goal**: Enable periodic background work and reporting.

**Deliverables**:
1. Batch job scheduler
2. Achievement unlock batch check
3. Analytics aggregation
4. Streak tracking
5. Recommendation regeneration

**Work**:

```typescript
// packages/lao-engine/src/services/batch/
- BatchJobScheduler
- AchievementBatchJob
- AnalyticsAggregationJob
- StreakTrackingJob
- RecommendationRegenerationJob

// Scheduling
- Daily: Streak reset, achievement checks
- Weekly: Analytics aggregation, path regeneration
- Monthly: Learner engagement analysis

// Jobs emit events for transparency
```

**Success Criteria**:
- Batch jobs execute on schedule
- No impact on real-time performance
- Jobs emit status events
- Analytics available for dashboard

---

## Phase 10: API Layer & Documentation (Weeks 20-21)

**Goal**: Complete API, SDKs, and documentation.

**Deliverables**:
1. HTTP API (all endpoints)
2. GraphQL endpoint (optional)
3. Client SDK (TypeScript)
4. API documentation
5. Postman collection

**Work**:

```
// API Gateway
- Authentication (JWT)
- Rate limiting
- Request validation
- Response formatting

// Endpoints by domain
- /api/learners/*
- /api/goals/*
- /api/missions/*
- /api/paths/*
- /api/assessments/*
- /api/achievements/*
- /api/recommendations/*

// Documentation
- API reference
- Integration guide
- Example requests
- Error codes
```

**Success Criteria**:
- All endpoints documented
- Can build UI using API
- Can build third-party integrations

---

## Phase 11: Testing & Quality Assurance (Weeks 22-23)

**Goal**: Comprehensive testing and performance validation.

**Deliverables**:
1. 80%+ unit test coverage
2. Integration tests
3. End-to-end scenario tests
4. Load testing
5. Security review

**Work**:

```
// Testing
- Unit tests for all services
- Integration tests for workflows
- Scenario tests (goal → path → mission → achievement)
- Load tests (1000+ concurrent learners)
- Security tests (injection, auth, etc.)

// Performance benchmarks
- Service latency <100ms (p95)
- Recommendation generation <500ms
- Event processing <50ms

// Documentation
- Test strategy
- Benchmark results
- Load testing report
```

**Success Criteria**:
- >80% code coverage
- All workflows tested end-to-end
- Load test passes (1000 concurrent)
- Security review passed

---

## Phase 12: Production Hardening (Weeks 24-25)

**Goal**: Ready for production deployment.

**Deliverables**:
1. Monitoring and observability
2. Error handling and recovery
3. Deployment documentation
4. Scaling configuration
5. Disaster recovery

**Work**:

```
// Observability
- Structured logging
- Metrics (Prometheus)
- Tracing (OpenTelemetry)
- Alerting

// Resilience
- Circuit breakers
- Retry logic
- Fallbacks
- Timeout management

// Documentation
- Deployment guide
- Configuration reference
- Troubleshooting guide
- Runbook for incidents
```

**Success Criteria**:
- All critical paths have monitoring
- Can detect and alert on failures
- Deployment tested in staging
- Runbooks documented

---

## Timeline Summary

| Phase | Duration | Focus | Deliverable |
|-------|----------|-------|-------------|
| 1 | Wk 1-3 | Foundation | Event system, base types |
| 2 | Wk 4-5 | Learners & Goals | Core entities |
| 3 | Wk 6-7 | Knowledge | Competencies, assessments |
| 4 | Wk 8-9 | Missions | Content, progress |
| 5 | Wk 10-11 | Basic Recommendations | Path generation |
| 6 | Wk 12-13 | Gamification | Achievements, credits |
| 7 | Wk 14-15 | AI Integration | Provider abstraction |
| 8 | Wk 16-17 | Advanced Rec. | Strategies, adaptation |
| 9 | Wk 18-19 | Batch/Analytics | Background work |
| 10 | Wk 20-21 | API Layer | Complete API |
| 11 | Wk 22-23 | Testing | QA, performance |
| 12 | Wk 24-25 | Hardening | Production ready |

**Total**: ~6 months to production-ready engine

---

## Milestones

**Milestone 1 (End of Week 3)**: Event-driven foundation working  
**Milestone 2 (End of Week 5)**: Learner and goal management  
**Milestone 3 (End of Week 9)**: Mission catalog and progress tracking  
**Milestone 4 (End of Week 11)**: Basic recommendations  
**Milestone 5 (End of Week 15)**: Gamification and AI ready  
**Milestone 6 (End of Week 21)**: Complete API  
**Milestone 7 (End of Week 25)**: Production-ready engine  

---

## Dependencies Between Phases

```
Phase 1 (Foundation)
   ↓
Phase 2 (Learners & Goals)
   ├─ Phase 3 (Knowledge)
   ├─ Phase 4 (Missions)
   │  ├─ Phase 5 (Basic Rec)
   │  │  ├─ Phase 8 (Advanced Rec)
   │  │  └─ Phase 9 (Batch)
   │  └─ Phase 6 (Achievements)
   │     └─ Phase 9 (Batch)
   └─ Phase 7 (AI)
      ├─ Phase 5 (Rec can use AI)
      └─ Phase 8 (Advanced Rec)

Phase 10 (API) depends on: 2-9
Phase 11 (Testing) depends on: 1-10
Phase 12 (Hardening) depends on: 1-11
```

**Key Insight**: Phases 3-7 can be partially parallelized after Phase 2 is stable.

---

## Quality Gates

Before moving to next phase:

- ✅ All tests passing
- ✅ Code review approved
- ✅ No TODO comments in code
- ✅ Coverage maintained
- ✅ Documentation up to date
- ✅ Demo works end-to-end

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Event system design wrong | Test thoroughly in Phase 1, refactor before Phase 2 |
| Recommendation algorithm poor | Have multiple strategies ready (Phase 5 & 8) |
| Performance issues | Load test early (Phase 11), optimize incrementally |
| AI integration breaks things | Mock provider for testing, gradual rollout |
| Scope creep | Strictly follow phase deliverables |

---

## Success Criteria

Engine is successful when:

✅ Phases 1-5 complete and tested  
✅ Can create goal → get path → complete missions  
✅ Achievements unlock correctly  
✅ AI optional but working  
✅ No direct dependencies on specific providers  
✅ Ready for UI teams to build against  

This roadmap ensures the engine is built systematically, tested thoroughly, and ready for scale from day one.

---

**Status**: Architecture Design Complete  
**Next Step**: Present for review before implementation begins
