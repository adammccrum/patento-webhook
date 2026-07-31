# Phase 3: Knowledge Intelligence Layer Architecture

## Vision

LAO evolves from a course platform to a **knowledge intelligence system**.

- **Old paradigm**: "Complete lesson 5, then take lesson 6"
- **New paradigm**: "What does this learner need to know next? What's the most valuable action to take?"

Knowledge is **living, personalized, and inferred from evidence**.

---

## Core Concepts

### Knowledge Graph

A directed graph where:

**Nodes represent:**
- Skills (Python, SQL, DevOps, etc.)
- Concepts (functions, recursion, normalization, etc.)
- Topics (backend development, data modeling, etc.)
- Technologies (PostgreSQL, AWS, Docker, etc.)
- Missions (learnable units from Phase 2)
- Goals (learner aspirations from Phase 2)
- Assessments (knowledge validation)
- Projects (real-world application)
- Certificates (credentials)
- Resources (articles, videos, documentation)
- AI Conversations (interactive learning)

**Edges represent relationships:**
- `teaches` — mission teaches skill
- `requires` — skill requires prerequisite
- `depends_on` — concept depends on prior concept
- `strengthens` — practice strengthens skill
- `related_to` — concepts are related
- `completed_by` — learner completed mission
- `assessed_by` — assessment validates skill
- `recommended_after` — action recommended after another

### Knowledge State

For each skill/concept/topic in the learner's graph:

```
KnowledgeNode {
  skillId: string
  learnerId: string
  
  // Current state
  masteryLevel: 0-100 (percentage)
  confidence: high | medium | low
  
  // Evidence
  evidence: Evidence[]  // assessments, completions, exercises
  
  // Memory
  misconceptions: string[]
  strengths: string[]
  weakAreas: string[]
  preferredExplanations: string[]  // "visual", "code-first", "story-based"
  
  // Temporal
  lastPracticedAt: ISO 8601
  nextReviewAt: ISO 8601  // spaced repetition
  forgettingCurve: number  // decay rate
  
  // Performance
  successRate: 0-100  // % of assessments passed
  averageTimeToMastery: minutes
  currentStreak: number  // consecutive successful attempts
  
  // Relationships
  prerequisitesMetAt: { skillId: ISO 8601 }[]
  prerequisitesNotMet: skillId[]
  dependentsNotYetReady: skillId[]
}
```

### Learner Memory

Persistent context that improves interactions:

```
LearnerMemory {
  learnerId: string
  
  // Misconceptions discovered
  misconceptions: {
    skillId: string
    misconception: string
    discoveredAt: ISO 8601
    correctedAt?: ISO 8601
  }[]
  
  // Learning patterns
  preferredPace: "slow" | "normal" | "fast"  // from Phase 1 + observed
  preferredLearningStyle: "visual" | "auditory" | "kinesthetic" | "reading"
  preferredExplanations: string[]  // "step-by-step", "big-picture", "analogies", "code-first"
  
  // Strengths and weaknesses
  strengths: {
    skillId: string
    evidence: string[]  // "completed 5 advanced assessments"
  }[]
  
  weakAreas: {
    skillId: string
    reason: string  // "struggled with recursion"
    attempts: number
  }[]
  
  // Confidence trends (for ML)
  confidenceTrend: {
    skillId: string
    measurements: { timestamp: ISO 8601, confidence: 0-100 }[]
  }[]
  
  // Recurring mistakes
  recurringMistakes: {
    skillId: string
    mistakePattern: string
    frequency: number
    lastOccurredAt: ISO 8601
  }[]
  
  // Successful strategies
  successfulStrategies: {
    skillId: string
    strategy: string  // "visualize as tree", "practice incrementally"
    effectiveness: 0-100
  }[]
  
  // Session history (last 20)
  sessionHistory: {
    timestamp: ISO 8601
    skillId: string
    actionType: "lesson" | "quiz" | "project" | "exercise" | "revision"
    outcome: "success" | "partial" | "failure"
    duration: minutes
    notes: string
  }[]
}
```

### Skill Dependency Graph

A focused subgraph showing prerequisites and mastery paths:

```
SkillDependency {
  skillId: string
  learnerId: string
  
  // What must be known first
  prerequisites: {
    skillId: string
    masteryLevelRequired: 0-100
    metAt?: ISO 8601
  }[]
  
  // What can't be learned yet
  blocked: {
    skillId: string
    reason: string  // "requires prerequisite"
  }[]
  
  // Mastery progression
  mastery: {
    level: "unfamiliar" | "aware" | "developing" | "proficient" | "expert"
    percentage: 0-100
    nextMilestone: number  // e.g., 50 (next level is at 50%)
  }
  
  // Related skills (not prerequisites)
  related: skillId[]
  
  // Evidence supporting prerequisites
  prerequisites_evidence: {
    skillId: string
    evidence: {
      assessmentId: string
      passed: boolean
      score: 0-100
      timestamp: ISO 8601
    }[]
  }[]
}
```

---

## Aggregates

### 1. KnowledgeState (New Root Aggregate)

**Owns:** Learner's knowledge of a single skill/concept/topic

**Invariants:**
- Mastery level cannot exceed 100
- Confidence must match evidence level
- Prerequisites must be met before high mastery
- Cannot forget what wasn't learned

**Commands:**
- `RecordAssessment(skillId, score, assessmentId)` → events about knowledge change
- `PracticeMission(skillId, missionId, comprehensionScore)` → events about skill strengthening
- `DiscoverMisconception(skillId, misconception)` → events about learning barriers
- `ApplyCorrectionFeedback(skillId, correction)` → events about misconception fixes
- `ScheduleReinforcementReview(skillId)` → events about spaced repetition

**Events:**
- `SkillAssessed` — assessment completed, score recorded
- `MasteryIncreased` — learner improved on skill
- `MasteryDecreased` — forgetting curve detected
- `MisconceptionDiscovered` — learning barrier identified
- `MisconceptionCorrected` — feedback applied
- `PrerequisiteMet` — learner now ready for dependent skill
- `PrerequisiteGap` — learner blocked on prerequisite
- `SkillReviewScheduled` — spaced repetition scheduled

**Read Models:**
- SkillMasteryProfile (current skill snapshot)
- SkillTimeline (mastery progression over time)
- PrerequisiteStatus (what blocks this skill)
- DependentSkills (what becomes available)

---

### 2. LearnerMemory (New Root Aggregate)

**Owns:** Learner's persistent learning context

**Invariants:**
- Session history limited to last 20 entries
- Misconceptions linked to evidence
- Strategies ranked by effectiveness

**Commands:**
- `RecordSession(skillId, actionType, outcome, duration)` → session history event
- `StoreMisconception(skillId, misconception, evidence)` → memory event
- `RecordSuccessfulStrategy(skillId, strategy, effectiveness)` → memory event
- `UpdateLearningPreferences(preferences)` → preference event
- `AddRecurringMistakePattern(skillId, pattern)` → pattern event

**Events:**
- `SessionRecorded` — learning action recorded
- `MisconceptionStored` — barrier documented
- `StrategyRecorded` — successful approach documented
- `PreferencesUpdated` — learning preferences refined
- `RecurringPatternDetected` — mistake pattern identified

**Read Models:**
- MemorySnapshot (current learner context)
- LearningPatterns (aggregated insights)
- StrategyRecommendations (for tutoring)

---

### 3. RecommendationContext (New Root Aggregate)

**Owns:** The data needed to make recommendations

**Composition:**
- Current KnowledgeState (all skills learner knows)
- LearnerMemory (context)
- LearnerGoal (from Phase 2)
- SkillDependencyGraph (prerequisites)
- TimeAvailable (from Learner preferences)
- RecentlyTried (to avoid repetition)

**No commands** — this is read-only, built from other aggregates

**Queries:**
- `GetReadySkills()` — skills learner can learn now
- `GetBlockedSkills()` — skills learner can't learn yet
- `GetPrerequisitesFor(skill)` — what's needed first
- `GetStaleSkills(days)` — skills not practiced recently
- `GetWeakAreas()` — low-confidence topics
- `GetStrongAreas()` — high-confidence topics

---

## Services (Phase 3 Additions)

### KnowledgeStateService

Manages skill/concept/topic knowledge for learners.

```typescript
interface IKnowledgeStateService extends IService {
  // Create knowledge state for new skill
  discoverSkill(learnerId: string, skillId: string, source: string): Promise<KnowledgeState>;
  
  // Record assessment result
  recordAssessment(learnerId: string, skillId: string, assessment: {
    assessmentId: string;
    score: 0-100;
    timestamp: string;
  }): Promise<KnowledgeState>;
  
  // Record mission completion
  recordMissionCompletion(learnerId: string, skillId: string, mission: {
    missionId: string;
    comprehensionScore: 0-100;
    timeSpentHours: number;
  }): Promise<KnowledgeState>;
  
  // Discover learning barrier
  recordMisconception(learnerId: string, skillId: string, misconception: string): Promise<KnowledgeState>;
  
  // Get current mastery
  getMastery(learnerId: string, skillId: string): Promise<KnowledgeState | null>;
  
  // Get all skills learner knows
  getKnowledge(learnerId: string): Promise<KnowledgeState[]>;
  
  // Schedule review (spaced repetition)
  scheduleReview(learnerId: string, skillId: string): Promise<KnowledgeState>;
}
```

**Event consumption:**
- From Phase 2 GoalService: `GoalCreated` → extract skills needed
- From Phase 2 ProgressService: `MissionCompleted` → update skill mastery
- From AssessmentService: `AssessmentPassed` / `AssessmentFailed` → update mastery

---

### LearnerMemoryService

Maintains persistent learning context.

```typescript
interface ILearnerMemoryService extends IService {
  // Record a learning session
  recordSession(learnerId: string, session: {
    skillId: string;
    actionType: "lesson" | "quiz" | "project" | "exercise" | "revision";
    outcome: "success" | "partial" | "failure";
    duration: number;  // minutes
  }): Promise<LearnerMemory>;
  
  // Store discovered misconception
  storeMisconception(learnerId: string, skillId: string, misconception: string): Promise<LearnerMemory>;
  
  // Record successful strategy
  recordStrategy(learnerId: string, skillId: string, strategy: string, effectiveness: 0-100): Promise<LearnerMemory>;
  
  // Get memory snapshot
  getMemory(learnerId: string): Promise<LearnerMemory | null>;
  
  // Get learning patterns
  getPatterns(learnerId: string): Promise<{
    preferredPace: string;
    preferredStyle: string;
    commonMistakes: { skill: string, pattern: string }[];
    successfulStrategies: { skill: string, strategy: string }[];
  }>;
}
```

---

### SkillDependencyGraphService

Manages prerequisite relationships and mastery paths.

```typescript
interface ISkillDependencyGraphService extends IService {
  // Define prerequisite relationship
  addPrerequisite(skillId: string, prerequisiteSkillId: string, requiredMastery: 0-100): Promise<void>;
  
  // Check if learner can learn skill
  canLearnSkill(learnerId: string, skillId: string): Promise<{
    canLearn: boolean;
    blockedBy: string[];  // prerequisite skills not yet learned
  }>;
  
  // Get prerequisites for skill
  getPrerequisites(skillId: string): Promise<{ skillId: string, requiredMastery: 0-100 }[]>;
  
  // Get dependent skills (unlocked by skill)
  getDependents(skillId: string): Promise<string[]>;
  
  // Get mastery path (progression from novice to expert)
  getMasteryPath(skillId: string): Promise<{
    level: string;
    percentage: 0-100;
    estimatedHours: number;
    nextMilestone: number;
  }[]>;
  
  // Get related skills (not prerequisites)
  getRelated(skillId: string): Promise<string[]>;
}
```

---

### RecommendationEngine (Redesigned for Phase 3)

No longer hardcoded learning paths. **Data-driven from knowledge graph.**

```typescript
interface IRecommendationEngine extends IService {
  // Get next most valuable action for learner
  recommendNextAction(learnerId: string, goalId?: string): Promise<{
    actionType: "mission" | "project" | "quiz" | "conversation" | "revision" | "exercise" | "real-world-task";
    actionId: string;
    actionTitle: string;
    targetSkillIds: string[];
    expectedOutcome: string;
    estimatedHours: number;
    reasoning: string;  // Why this action now?
    alternatives: { actionId: string; title: string; reason: string }[];
  }>;
  
  // Get actions for specific skill
  recommendActionsForSkill(learnerId: string, skillId: string): Promise<{
    actionId: string;
    actionTitle: string;
    type: string;
    difficulty: 0-100;
    estimatedHours: number;
  }[]>;
  
  // Get reinforcement recommendations (spaced repetition)
  getReinforcementActions(learnerId: string): Promise<{
    skillId: string;
    skillName: string;
    actionId: string;
    actionTitle: string;
    reason: string;  // "not practiced in 5 days", "accuracy 65%"
    urgency: "low" | "medium" | "high";
  }[]>;
  
  // Get gap analysis
  getGapAnalysis(learnerId: string, goalId: string): Promise<{
    goalTitle: string;
    requiredSkills: string[];
    acquiredSkills: string[];
    gaps: {
      skillId: string;
      skillName: string;
      currentMastery: 0-100;
      requiredMastery: 0-100;
      prerequisitesForGap: string[];
    }[];
    estimatedHoursToClose: number;
  }>;
  
  // Get learning velocity insight
  getLearningVelocity(learnerId: string): Promise<{
    skillsAcquiredThisMonth: number;
    averageTimePerSkill: number;
    accelerating: boolean;
    momentum: 0-100;
  }>;
}
```

**Recommendation Algorithm (Knowledge-Driven):**

1. Get learner's knowledge graph (all mastered, developing, ready-to-learn skills)
2. Get learner's goals (from Phase 2)
3. For each goal, identify required skills (from skill dependency graph)
4. Identify skill gaps (required but not learned)
5. Check prerequisites for gaps (can learner learn this now?)
6. Get learner memory (misconceptions, weak areas, successful strategies)
7. Rank possible actions by:
   - Contribution to goal (how much does this move learner closer?)
   - Readiness (are prerequisites met?)
   - Learner memory (is there a known misconception to address?)
   - Engagement pattern (diversity, preferred types)
   - Time investment (estimated hours vs available)
   - Reinforcement need (when did learner last practice this skill?)
8. Return top action with reasoning and alternatives

---

### GapAnalysisEngine (New)

Identifies what's missing between current state and goals.

```typescript
interface IGapAnalysisEngine extends IService {
  // Get gaps preventing goal achievement
  analyzeGoal(learnerId: string, goalId: string): Promise<{
    goal: { id: string; title: string; targetValue: number };
    
    // Current state
    currentSkills: { skillId: string; masteryLevel: 0-100 }[];
    
    // Required state
    requiredSkills: { skillId: string; requiredMastery: 0-100 }[];
    
    // Gaps identified
    directGaps: {  // Required but missing
      skillId: string;
      skill: string;
      currentMastery: 0-100;
      requiredMastery: 0-100;
    }[];
    
    indirectGaps: {  // Prerequisites of gaps
      skillId: string;
      skill: string;
      prerequisiteOf: string;
    }[];
    
    // Action plan
    actionPlan: {
      phase: number;
      skills: string[];
      actions: { actionId: string; title: string; estimatedHours: number }[];
      estimatedDaysToComplete: number;
    }[];
    
    // Confidence in analysis
    confidence: 0-100;
  }>;
  
  // Find skills learner should practice (weak areas)
  findReinforcementNeeds(learnerId: string): Promise<{
    skillId: string;
    currentMastery: 0-100;
    targetMastery: 0-100;
    daysNotPracticed: number;
    successRate: 0-100;
    recommendation: "urgent" | "soon" | "optional";
  }[]>;
  
  // Detect misconception-induced gaps
  detectMisconceptionGaps(learnerId: string): Promise<{
    skillId: string;
    misconception: string;
    affectedDownstream: string[];  // Skills that depend on this
    correctionAction: { actionId: string; title: string };
  }[]>;
}
```

---

## Event Flows (Phase 3)

### When Learner Completes a Mission (from Phase 2)

```
MissionCompleted (from ProgressService)
  ├─> KnowledgeStateService.recordMissionCompletion()
  │    └─> SkillAssessed event (for each taught skill)
  │         ├─> Update mastery level
  │         ├─> Check if prerequisites now met
  │         └─> Unlock dependent skills
  │
  ├─> LearnerMemoryService.recordSession()
  │    └─> SessionRecorded event
  │         └─> Add to learner's session history
  │
  └─> RecommendationEngine invalidated
       └─> Next call to recommendNextAction() gets fresh analysis
```

### When Learner Takes Assessment

```
AssessmentCompleted (from AssessmentService)
  ├─> KnowledgeStateService.recordAssessment()
  │    └─> SkillAssessed event
  │         ├─> Update mastery (score → confidence)
  │         └─> If low score → check for misconceptions
  │
  ├─> LearnerMemoryService.recordSession()
  │    └─> SessionRecorded event
  │
  └─> If assessment reveals misconception
       └─> DiscoverMisconception event
            └─> Store in LearnerMemory for AI tutoring
```

### When Spaced Repetition is Triggered

```
ReviewScheduled (from KnowledgeStateService)
  └─> RecommendationEngine.getReinforcementActions()
       └─> Recommend review session (quiz, exercise, conversation)
            └─> High priority in next recommendations
```

---

## State Machines

### Mastery Level Progression

```
unfamiliar (0%)
    ↓ [action: learn]
aware (20%)
    ↓ [action: practice]
developing (40%)
    ↓ [action: apply]
proficient (70%)
    ↓ [action: master]
expert (100%)
    ↓ [time: no practice for 180 days]
proficient (70%) [forgetting curve]
```

### Misconception Lifecycle

```
unknown
    ↓ [discovered during assessment]
identified
    └─ correctedAt: null
       ├─ [feedback provided]
       └─> correctedAt: timestamp
           └─> resolved
```

---

## Integration with Phase 1 & 2

### Phase 1 (Infrastructure)
- **Uses**: EventStore, EventBus, EventCatalog
- **New events added**: SkillAssessed, MasteryIncreased, MisconceptionDiscovered, PrerequisiteMet, etc.

### Phase 2 (Services & Goals)
- **Consumes**: GoalCreated → extract required skills
- **Consumes**: MissionCompleted → update skill mastery
- **Consumes**: GoalProgressUpdated → adjust skill focus
- **Produces**: Recommendation events

### Read Models
- **Knowledge Dashboard**: Skill mastery heatmap
- **Memory Summary**: Learning patterns and strategies
- **Gap Analysis**: What's needed for each goal
- **Recommendation List**: Next 5 actions ranked

---

## Data Structures (Simplified)

### Knowledge Graph Node
```typescript
{
  id: string;  // skill-python, concept-recursion, topic-backend
  type: "skill" | "concept" | "topic" | "technology" | "mission" | "goal" | "assessment" | "project" | "certificate" | "resource" | "conversation";
  title: string;
  description: string;
  createdAt: ISO 8601;
}
```

### Knowledge Graph Edge
```typescript
{
  from: string;  // node id
  to: string;    // node id
  type: "teaches" | "requires" | "depends_on" | "strengthens" | "related_to" | "completed_by" | "assessed_by" | "recommended_after";
  weight: 0-100;  // strength of relationship
  metadata?: Record<string, unknown>;
}
```

### KnowledgeState Snapshot
```typescript
{
  learnerId: string;
  skillId: string;
  masteryLevel: 0-100;
  confidence: 0-100;
  evidence: Assessment[];
  lastPracticedAt: ISO 8601;
  nextReviewAt: ISO 8601;
  forgettingCurve: 0-100;
  successRate: 0-100;
}
```

---

## Recommendation Example

**Learner Profile:**
- Goal: Become Backend Developer
- Mastered: HTML, CSS, JavaScript
- Developing: SQL (60%)
- Weak: Database design (35%)
- Available: 3 hours/week
- Misconception: Thinks all databases are the same

**Analysis:**
1. Goal requires: Backend Language, Database, Architecture, DevOps
2. Learning path: Complete JavaScript → Learn Python → Learn Database → Learn Architecture
3. Current bottleneck: Database knowledge (35% on design, misconception about differences)
4. Prerequisites for Python: None met, can start anytime
5. Memory says: Learner prefers "code-first" explanation, struggled with abstract concepts

**Recommendation:**
```
Next Action: "SQL Practice Project: Design a Blog Database"
Why: Addresses misconception about databases through hands-on design.
     Builds on mastered HTML/CSS. Prerequisite for Backend Language.
Type: Project (not lesson)
Skills: SQL, Database Design, Normalization
Duration: 4 hours
Alternatives:
  - Quiz: "Database Concepts" (fill misconception gap faster)
  - Exercise: "SQL Joins Practice" (reinforce SQL 60%)
```

---

## Success Metrics

Phase 3 succeeds when:

1. **Knowledge Graph is accurate**: Skills linked with correct prerequisites
2. **Recommendations improve outcomes**: Learners reach goals faster than before
3. **Memory improves interactions**: AI tutoring personalizes based on stored patterns
4. **Gap analysis prevents wasted effort**: Learners never hit unmet prerequisites
5. **Reinforcement model maintains mastery**: Skills don't decay

---

## Next Steps

**Phase 3 Architecture Complete**: Stop and await review.

**Phase 3 Implementation** (when approved): Build knowledge graph, aggregates, services, recommendation engine.

**Phase 4** (future): AI-assisted tutoring using knowledge graph + memory model.

