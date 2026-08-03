# LAO Intelligence Engine — Architecture Overview

**Status**: Architecture Design  
**Version**: 1.0  
**Last Updated**: 2024-07-31

---

## Architecture at a Glance

The LAO Intelligence Engine is a set of loosely-coupled services coordinated through events. The engine contains no UI code and remains provider-agnostic.

```
┌────────────────────────────────────────────────────────────────┐
│                     Client Layer                               │
│              (Web UI, Mobile, API Clients)                      │
└────────────────────────────────────────────────────────────────┘
                              ↑
                              │ HTTP/GraphQL
                              ↓
┌────────────────────────────────────────────────────────────────┐
│                   API Gateway / Router                          │
│         (Route requests to appropriate services)                │
└────────────────────────────────────────────────────────────────┘
                              ↑
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ↓                 ↓                 ↓
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Learner Service  │  │  Goal Service    │  │ Mission Service  │
│                  │  │                  │  │                  │
│ - Create learner │  │ - Create goal    │  │ - Curate mission │
│ - Preferences    │  │ - Track progress │  │ - Define content │
│ - Profile        │  │ - Manage status  │  │ - Unlock logic   │
└──────────────────┘  └──────────────────┘  └──────────────────┘

            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ↓                 ↓                 ↓
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│Learning Path Svc │  │Recommendation Eng│  │ Knowledge Service│
│                  │  │                  │  │                  │
│ - Generate path  │  │ - Rank missions  │  │ - Track skills   │
│ - Reorder        │  │ - AI integration │  │ - Detect gaps    │
│ - Track progress │  │ - Strategy mgmt  │  │ - Infer state    │
└──────────────────┘  └──────────────────┘  └──────────────────┘

            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ↓                 ↓                 ↓
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│Progress Service  │  │Achievement Svc   │  │Assessment Svc    │
│                  │  │                  │  │                  │
│ - Aggregate prog │  │ - Award badges   │  │ - Grading        │
│ - Calc velocity  │  │ - Check criteria │  │ - Feedback       │
│ - Streak track   │  │ - Credit system  │  │ - Results        │
└──────────────────┘  └──────────────────┘  └──────────────────┘

            ┌────────────────────────────────────┐
            │      Event Bus (Pub/Sub)            │
            │  (Redis, SQS, RabbitMQ, etc.)       │
            └────────────────────────────────────┘
                  │       │       │       │
          ┌───────┼───────┼───────┼───────┴────────┐
          │                                        │
          ↓                                        ↓
┌──────────────────────────┐        ┌──────────────────────────┐
│ Event Subscribers        │        │ AI Provider Service      │
│                          │        │ (Abstract Interface)     │
│ - State machines         │        │                          │
│ - Cascade updates        │        │ - Claude                 │
│ - Notifications          │        │ - OpenAI (GPT)           │
│ - Analytics              │        │ - Google (Gemini)        │
│ - Audit trail            │        │ - Others (pluggable)     │
└──────────────────────────┘        └──────────────────────────┘

            ┌────────────────────────────────────┐
            │    Persistence & Caching           │
            │                                    │
            │ PostgreSQL (primary data)          │
            │ Redis (working sets, cache)        │
            │ Event Log (audit trail)            │
            └────────────────────────────────────┘
```

---

## Data Flow Example: Learner Creates Goal

```
1. USER ACTION
   ┌─────────────┐
   │ User clicks │
   │"Create Goal"│
   └─────────────┘
         ↓
2. API CALL
   ┌──────────────────────────────────┐
   │ POST /api/goals                  │
   │ { title, description, ... }      │
   └──────────────────────────────────┘
         ↓
3. GOAL SERVICE
   ┌──────────────────────────────────┐
   │ 1. Validate input                │
   │ 2. Create goal in database       │
   │ 3. Emit GoalCreatedEvent         │
   └──────────────────────────────────┘
         ↓
4. KNOWLEDGE SERVICE (listening to GoalCreated)
   ┌──────────────────────────────────┐
   │ 1. Analyze goal requirements     │
   │ 2. Get learner's KnowledgeState  │
   │ 3. Detect gaps                   │
   │ 4. Emit KnowledgeGapDetected     │
   └──────────────────────────────────┘
         ↓
5. RECOMMENDATION ENGINE
   ┌──────────────────────────────────┐
   │ 1. Receive GoalCreated event     │
   │ 2. Get learner profile           │
   │ 3. Get learner knowledge state   │
   │ 4. Fetch mission catalog         │
   │ 5. Rank missions by relevance    │
   │ 6. Call GeneratePath strategy    │
   │ 7. Return recommended sequence   │
   └──────────────────────────────────┘
         ↓
6. LEARNING PATH SERVICE
   ┌──────────────────────────────────┐
   │ 1. Receive recommendations       │
   │ 2. Create learning path          │
   │ 3. Persist to database           │
   │ 4. Emit LearningPathGenerated    │
   └──────────────────────────────────┘
         ↓
7. MISSION SERVICE (listening to LearningPathGenerated)
   ┌──────────────────────────────────┐
   │ 1. Get first mission in path     │
   │ 2. Check unlock criteria         │
   │ 3. Update mission availability   │
   │ 4. Emit MissionUnlocked          │
   └──────────────────────────────────┘
         ↓
8. API RESPONSE
   ┌──────────────────────────────────┐
   │ 200 OK                           │
   │ {                                │
   │   goalId: ...,                   │
   │   learningPath: {...},           │
   │   nextMission: {...}             │
   │ }                                │
   └──────────────────────────────────┘
         ↓
9. UI UPDATE
   ┌──────────────────────────────────┐
   │ Display:                         │
   │ - Goal summary                   │
   │ - Learning path timeline         │
   │ - First mission to start         │
   └──────────────────────────────────┘
```

---

## Service Dependencies & Communication

### Synchronous (Request/Response)

Services call other services when they need immediate data:

```
RecommendationEngine
  → fetches from MissionService (get all missions)
  → fetches from GoalService (get goal details)
  → fetches from KnowledgeService (get learner state)
  → returns ranked missions
```

### Asynchronous (Event-Driven)

Services react to events from other services:

```
GoalService emits GoalCreatedEvent
  ↓
KnowledgeService listens, detects gaps, emits KnowledgeGapDetectedEvent
  ↓
RecommendationEngine receives both events, generates path
  ↓
LearningPathService receives path, emits LearningPathGeneratedEvent
  ↓
MissionService listens, unlocks first mission, emits MissionUnlockedEvent
  ↓
(Events propagate down the graph)
```

---

## Package Structure

```
packages/
  lao-engine/
    ├── src/
    │   ├── domain/
    │   │   ├── learner/
    │   │   │   ├── Learner.ts
    │   │   │   ├── LearnerService.ts
    │   │   │   └── LearnerRepository.ts
    │   │   ├── goal/
    │   │   │   ├── Goal.ts
    │   │   │   ├── GoalService.ts
    │   │   │   └── GoalRepository.ts
    │   │   ├── mission/
    │   │   │   ├── Mission.ts
    │   │   │   ├── MissionService.ts
    │   │   │   └── MissionRepository.ts
    │   │   ├── path/
    │   │   ├── knowledge/
    │   │   ├── progress/
    │   │   ├── achievement/
    │   │   └── assessment/
    │   │
    │   ├── events/
    │   │   ├── DomainEvent.ts
    │   │   ├── EventBus.ts
    │   │   ├── EventStore.ts
    │   │   └── eventCatalog.ts
    │   │
    │   ├── services/
    │   │   ├── RecommendationEngine.ts
    │   │   ├── AIProvider.ts (abstract)
    │   │   └── StateTransitionEngine.ts
    │   │
    │   ├── shared/
    │   │   ├── types.ts
    │   │   ├── errors.ts
    │   │   └── utils.ts
    │   │
    │   └── index.ts (exports public API)
    │
    ├── __tests__/
    │   ├── unit/
    │   ├── integration/
    │   └── fixtures/
    │
    └── package.json
```

---

## Key Abstractions

### 1. Service Interface

Each service implements a consistent interface:

```typescript
interface IService {
  // Queries (read-only)
  [queryMethods](): Promise<T>;
  
  // Commands (state-changing)
  [commandMethods](): Promise<void | Result>;
  
  // Event subscriptions
  onEventReceived(event: DomainEvent): Promise<void>;
  
  // Health check
  healthCheck(): Promise<HealthStatus>;
}
```

### 2. Event Interface

All events follow standard structure:

```typescript
interface DomainEvent {
  eventId: UUID;
  eventType: string;
  version: number;
  aggregateId: UUID;
  aggregateType: string;
  data: EventPayload;
  timestamp: DateTime;
  correlationId: UUID;
}
```

### 3. Repository Pattern

Data access is abstracted:

```typescript
interface IRepository<T> {
  findById(id: UUID): Promise<T | null>;
  save(entity: T): Promise<void>;
  update(entity: T): Promise<void>;
  delete(id: UUID): Promise<void>;
  query(criteria: QueryCriteria): Promise<T[]>;
}
```

### 4. AI Provider

AI is abstracted behind interface:

```typescript
interface IAIProvider {
  generateCompletion(prompt: string, context: Context): Promise<string>;
  generateExplanation(concept: string): Promise<string>;
  scoreEssay(essay: string, rubric: Rubric): Promise<Score>;
}

// Implementations
class ClaudeAIProvider implements IAIProvider { ... }
class OpenAIProvider implements IAIProvider { ... }
class MockAIProvider implements IAIProvider { ... } // for testing
```

---

## Configuration

Engine behavior is configurable:

```typescript
interface LAOEngineConfig {
  // AI
  aiProvider: 'claude' | 'openai' | 'gemini' | 'mock';
  
  // Recommendation
  recommendationStrategy: 'goal-driven' | 'skill-driven' | 'interest-driven';
  maxPathLength: number; // max missions in generated path
  
  // Timing
  streakResetAfterDays: number;
  achievementCheckInterval: 'immediate' | 'batch' | 'hybrid';
  
  // Scaling
  enableCaching: boolean;
  enableBatchProcessing: boolean;
  maxConcurrentRecommendations: number;
  
  // Features
  enableAIAssistance: boolean;
  enablePersonalization: boolean;
  enableGamification: boolean;
}
```

---

## Error Handling

Engine must gracefully handle failures:

```typescript
// Service A calls Service B, B is down
// Options:
// 1. Return cached data (if available)
// 2. Fail fast with clear error
// 3. Retry with exponential backoff
// 4. Use fallback recommendation

// Recommendation engine unavailable?
// → Use simple 'next-sequential' strategy

// AI provider rate limited?
// → Return non-AI explanation

// Database down?
// → Return cached state, queue events for retry
```

---

## Testing Strategy

Engine must be thoroughly testable:

### 1. Unit Tests
- Service methods in isolation
- Mock dependencies
- Event emission verification

### 2. Integration Tests
- Multiple services working together
- Event propagation across services
- Database persistence

### 3. Scenario Tests
- End-to-end learner journeys
- Full workflows (goal → path → mission → achievement)

### 4. Property-Based Tests
- Invariants (e.g., no circular skill dependencies)
- State consistency

### Example Test

```typescript
describe('Goal Creation Workflow', () => {
  it('should create goal, detect gaps, and generate path', async () => {
    // Setup
    const learner = await learnerService.createLearner({...});
    const eventBus = new EventBus();
    
    // Act
    const goal = await goalService.createGoal(learner.id, {
      title: 'Learn Machine Learning',
      goalType: 'skill',
      targetValue: 5,
      targetUnit: 'projects'
    });
    
    // Assert
    expect(goal.status).toBe('active');
    
    // Wait for events to propagate
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check side effects
    const knowledgeGaps = await knowledgeService.getGaps(learner.id);
    expect(knowledgeGaps.length).toBeGreaterThan(0);
    
    const path = await learningPathService.getLearnerPaths(learner.id);
    expect(path.length).toBeGreaterThan(0);
    expect(path[0].goalId).toBe(goal.id);
  });
});
```

---

## Monitoring & Observability

Engine must expose metrics:

```typescript
interface EngineMetrics {
  // Service metrics
  serviceCallLatency: HistogramMetric;
  serviceErrorRate: GaugeMetric;
  
  // Event metrics
  eventsProcessed: CounterMetric;
  eventBacklogSize: GaugeMetric;
  eventProcessingLatency: HistogramMetric;
  
  // Recommendation metrics
  recommendationQuality: GaugeMetric; // user acceptance rate
  pathCompletionRate: GaugeMetric;
  
  // AI metrics
  aiCallLatency: HistogramMetric;
  aiCost: GaugeMetric;
  aiErrorRate: GaugeMetric;
}

// Prometheus export
app.get('/metrics', (req, res) => {
  res.type('text/plain');
  res.send(register.metrics());
});
```

---

## Deployment Options

Engine can be deployed in multiple topologies:

### Option 1: Monolith
```
Single Node.js process
- All services in one process
- Single database
- Good for: <100k learners
```

### Option 2: Modular
```
Multiple Node.js processes (same machine)
- Each service separate process
- Shared database
- IPC/HTTP for communication
- Good for: 100k-1M learners
```

### Option 3: Microservices
```
Multiple containers/machines
- Each service own container
- Database per service (if necessary)
- API gateway coordinates
- Good for: 1M+ learners
```

---

## Key Principles

1. **Behavior before presentation**: Engine logic is testable, usable without UI
2. **Loosely coupled**: Services don't directly call each other's private methods
3. **Highly cohesive**: Each service owns its domain
4. **Event-driven**: State changes flow through event system
5. **Provider agnostic**: AI, storage, etc. are pluggable
6. **Scalable by design**: Can grow from single process to distributed system
7. **Debuggable**: Full event history and request tracing
8. **Testable**: Can run without external dependencies (mocks available)

---

## Success Criteria

Engine is successful when:

✅ Can be used by multiple UI clients (web, mobile, desktop, API)  
✅ Supports millions of learners without architectural changes  
✅ Can switch AI providers without code changes  
✅ 100% event traceability for debugging and compliance  
✅ <100ms response time for core queries (with caching)  
✅ Vertical and horizontal scaling supported  
✅ All domain logic is unit-testable  
✅ No UI code in the engine  

---

**Next Document**: IMPLEMENTATION_ROADMAP.md  
**Status**: Ready for review
