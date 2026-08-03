# LAO Intelligence Engine — Service Interfaces

**Status**: Architecture Design  
**Version**: 1.0  
**Last Updated**: 2024-07-31

---

## Overview

The LAO Intelligence Engine is composed of independently deployable services. Each service owns a specific domain responsibility and communicates through well-defined interfaces.

Services are loosely coupled (via events), highly cohesive (single responsibility), and independently testable.

---

## Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (HTTP)                          │
└─────────────────────────────────────────────────────────────┘

┌──────────────┬──────────────┬──────────────┬──────────────────┐
│   Learner    │    Goal      │   Mission    │   Assessment     │
│   Service    │   Service    │   Service    │   Service        │
└──────────────┴──────────────┴──────────────┴──────────────────┘

┌──────────────┬──────────────┬──────────────┬──────────────────┐
│   Learning   │ Recommendation│  Achievement │  Knowledge       │
│   Path       │   Engine      │   Service    │   Service        │
│   Service    │              │              │                  │
└──────────────┴──────────────┴──────────────┴──────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Event Bus                                 │
│        (Pub/Sub - Redis, AWS SQS, or local)                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 Persistence Layer                            │
│     (PostgreSQL + Redis Cache + Event Log)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Service Definitions

### 1. Learner Service

**Purpose**: Manages learner identity, preferences, and profile.

**Owned Data**
- Learner profile
- Learner preferences
- Learner activation status
- Activity logs

**Interface**

```typescript
interface ILearnerService {
  // Queries
  getLearner(learnerId: UUID): Promise<Learner>;
  getLearnerByEmail(email: string): Promise<Learner | null>;
  searchLearners(query: SearchQuery): Promise<Learner[]>;
  
  // Commands
  createLearner(input: CreateLearnerInput): Promise<Learner>;
  updatePreferences(learnerId: UUID, prefs: Partial<LearnerPreferences>): Promise<Learner>;
  updateProfile(learnerId: UUID, profile: Partial<LearnerProfile>): Promise<Learner>;
  deactivateLearner(learnerId: UUID, reason: string): Promise<void>;
  reactivateLearner(learnerId: UUID): Promise<Learner>;
  
  // Events produced
  // - UserOnboarded
  // - LearnerPreferencesUpdated
  // - LearnerDeactivated
  
  // Events consumed
  // None (learner service is a root)
}

interface CreateLearnerInput {
  email: string;
  name: string;
  learningStyle: LearnerStyle;
  pacePreference: PacePreference;
  availableHoursPerWeek: number;
  timezone: string;
  preferredLanguage: string;
}
```

**Responsibilities**
- Create and maintain learner records
- Manage preferences
- Track activity
- Enforce learner lifecycle rules
- Emit learner lifecycle events

**Constraints**
- Learner service cannot directly call other services (loose coupling)
- All learner modifications trigger events

---

### 2. Goal Service

**Purpose**: Manages learner goals and goal progress.

**Owned Data**
- Goals
- Goal status
- Goal-mission mappings

**Interface**

```typescript
interface IGoalService {
  // Queries
  getGoal(goalId: UUID): Promise<Goal>;
  getLearnerGoals(learnerId: UUID): Promise<Goal[]>;
  getActiveGoals(learnerId: UUID): Promise<Goal[]>;
  getGoalsByType(learnerId: UUID, type: GoalType): Promise<Goal[]>;
  getGoalProgress(goalId: UUID): Promise<GoalProgress>;
  
  // Commands
  createGoal(learnerId: UUID, input: CreateGoalInput): Promise<Goal>;
  updateGoal(goalId: UUID, changes: Partial<Goal>): Promise<Goal>;
  updateGoalProgress(goalId: UUID, progress: GoalProgress): Promise<void>;
  achieveGoal(goalId: UUID): Promise<void>;
  abandonGoal(goalId: UUID, reason: string): Promise<void>;
  
  // Events produced
  // - GoalCreated
  // - GoalUpdated
  // - GoalAchieved
  // - GoalAbandoned
  
  // Events consumed
  // - MissionCompleted (update goal progress)
  // - LearningPathGenerated (link goal to path)
}

interface CreateGoalInput {
  title: string;
  description: string;
  goalType: GoalType;
  category: string;
  targetValue: number;
  targetUnit: string;
  deadline?: DateTime;
  priority: number; // 1-5
}
```

**Responsibilities**
- Create and update goals
- Track goal progress
- Determine goal completion
- Support goal-mission relationships
- Emit goal lifecycle events

**Constraints**
- Cannot create learning paths directly (delegates to LearningPathService)
- Consumes MissionCompleted events to update progress

---

### 3. Mission Service

**Purpose**: Manages missions and their structure.

**Owned Data**
- Missions
- Lessons
- Assessments
- Resources
- Mission unlock criteria

**Interface**

```typescript
interface IMissionService {
  // Queries
  getMission(missionId: UUID): Promise<Mission>;
  getMissionsBySkill(skillId: UUID): Promise<Mission[]>;
  getMissionsByGoal(goalId: UUID): Promise<Mission[]>;
  getLessonsByMission(missionId: UUID): Promise<Lesson[]>;
  getAssessments(missionId: UUID): Promise<Assessment[]>;
  canUnlockMission(learnerId: UUID, missionId: UUID): Promise<boolean>;
  getMissionUnlockReasons(learnerId: UUID, missionId: UUID): Promise<UnlockReason[]>;
  
  // Commands
  createMission(input: CreateMissionInput): Promise<Mission>;
  updateMission(missionId: UUID, changes: Partial<Mission>): Promise<Mission>;
  addLesson(missionId: UUID, lesson: CreateLessonInput): Promise<Lesson>;
  updateLesson(lessonId: UUID, changes: Partial<Lesson>): Promise<Lesson>;
  addAssessment(missionId: UUID, assessment: CreateAssessmentInput): Promise<Assessment>;
  
  // Events produced
  // None (Mission service is mostly read-only from event perspective)
  
  // Events consumed
  // - LearningPathGenerated (make mission available)
  // - MissionCompleted (for analytics)
}

interface CreateMissionInput {
  title: string;
  slug: string;
  description: string;
  objective: string;
  difficulty: Difficulty;
  estimatedDurationHours: number;
  teachesSkills: UUID[];
  requiresSkills: UUID[];
  supportsGoals?: UUID[];
}
```

**Responsibilities**
- Curate mission content
- Define mission structure
- Determine mission unlock prerequisites
- Maintain mission metadata
- Support mission search and discovery

**Constraints**
- Mission service is largely static (content doesn't change frequently)
- All missions created via admin/curation system, not learner actions

---

### 4. Learning Path Service

**Purpose**: Generates and manages personalized learning sequences.

**Owned Data**
- Learning paths
- Path-mission assignments
- Path sequencing

**Interface**

```typescript
interface ILearningPathService {
  // Queries
  getLearningPath(pathId: UUID): Promise<LearningPath>;
  getLearnerLearningPaths(learnerId: UUID): Promise<LearningPath[]>;
  getActiveLearningPath(learnerId: UUID): Promise<LearningPath | null>;
  getPathMissions(pathId: UUID): Promise<PathMission[]>;
  getNextUnlockedMission(learnerId: UUID, pathId: UUID): Promise<Mission | null>;
  
  // Commands
  generateLearningPath(learnerId: UUID, goalId: UUID): Promise<LearningPath>;
  reorderPath(pathId: UUID, reason: string): Promise<LearningPath>;
  updateMissionStatus(pathId: UUID, missionId: UUID, status: MissionStatus): Promise<void>;
  completePath(pathId: UUID): Promise<void>;
  
  // Dependency: RecommendationEngine
  generateLearningPath() calls recommendation engine
  
  // Events produced
  // - LearningPathGenerated
  // - LearningPathReordered
  // - LearningPathCompleted
  // - MissionUnlocked
  
  // Events consumed
  // - GoalCreated (generate path)
  // - MissionCompleted (update path progress, reorder if needed)
  // - CompetencyUpdated (reorder if skill now unlocks new path)
}

interface CreatePathInput {
  learnerId: UUID;
  goalId: UUID;
  missions: UUID[];
}
```

**Responsibilities**
- Generate optimal mission sequences
- Reorder paths based on progress
- Determine which missions to unlock
- Track path status and progress
- Integrate with recommendation engine

**Constraints**
- Delegates recommendation logic to RecommendationEngine
- Cannot directly modify mission content

---

### 5. Recommendation Engine

**Purpose**: Generates intelligent recommendations for next learning activities.

**Owned Data**
- Recommendation models
- Recommendation history
- Strategy configurations

**Interface**

```typescript
interface IRecommendationEngine {
  // Queries
  getRecommendedMissions(learnerId: UUID, limit?: number): Promise<RecommendedMission[]>;
  getRecommendedPath(learnerId: UUID, goalId: UUID): Promise<RecommendedPath>;
  explainRecommendation(recommendationId: UUID): Promise<RecommendationExplanation>;
  
  // Commands
  generateRecommendations(learnerId: UUID): Promise<Recommendation[]>;
  rankMissionsByGoal(learnerId: UUID, goalId: UUID, missions: Mission[]): Promise<RankedMission[]>;
  evaluatePathQuality(path: LearningPath): Promise<PathQuality>;
  
  // Strategy API
  // Multiple recommendation strategies can coexist
  registerStrategy(name: string, strategy: RecommendationStrategy): void;
  setActiveStrategy(learnerId: UUID, strategy: string): Promise<void>;
  
  // Events produced
  // - AIRecommendationMade (if using AI)
  
  // Events consumed
  // - GoalCreated
  // - MissionCompleted
  // - CompetencyUpdated
  // - KnowledgeGapDetected
}

interface RecommendedMission {
  missionId: UUID;
  score: number; // 0-100, recommendation confidence
  reason: string; // Why this mission is recommended
  estimatedTimeToCompletion: number;
}

interface RecommendationStrategy {
  name: string;
  rank(learnerId: UUID, missions: Mission[], context: RecommendationContext): Promise<RankedMission[]>;
}

interface RecommendationContext {
  goals: Goal[];
  knowledgeState: KnowledgeState;
  recentCompletions: Mission[];
  availableTime: number;
  learningStyle: LearnerStyle;
}
```

**Responsibilities**
- Analyze learner state to generate recommendations
- Rank missions by relevance and difficulty
- Support multiple recommendation strategies
- Optimize learning path quality
- Provide explainability for recommendations

**Constraints**
- Pure logic service (no side effects on write)
- Can read from other services but doesn't write to them

---

### 6. Progress Service

**Purpose**: Tracks and measures learner progress.

**Owned Data**
- Mission progress
- Goal progress
- Completion history
- Time tracking
- Velocity metrics

**Interface**

```typescript
interface IProgressService {
  // Queries
  getLearnerProgress(learnerId: UUID): Promise<Progress>;
  getMissionProgress(learnerId: UUID, missionId: UUID): Promise<MissionProgress>;
  getGoalProgress(learnerId: UUID, goalId: UUID): Promise<GoalProgress>;
  getPathProgress(learnerId: UUID, pathId: UUID): Promise<PathProgress>;
  getVelocity(learnerId: UUID): Promise<Velocity>;
  getStreak(learnerId: UUID): Promise<Streak>;
  
  // Commands
  startMission(learnerId: UUID, missionId: UUID): Promise<MissionProgress>;
  completeMission(learnerId: UUID, missionId: UUID, score: number): Promise<MissionProgress>;
  updateMissionProgress(learnerId: UUID, missionId: UUID, delta: ProgressDelta): Promise<void>;
  
  // Events produced
  // None (Progress service is derived from other events)
  
  // Events consumed
  // - MissionStarted
  // - LessonCompleted
  // - MissionCompleted
  // - GoalAchieved
  // - AssessmentAttempted
}

interface Velocity {
  avgHoursPerMission: number;
  avgMissionsPerWeek: number;
  trend: 'accelerating' | 'steady' | 'decelerating';
  speedFactor: number; // 0.5 to 2.0
}

interface Streak {
  currentDays: number;
  longestDays: number;
  lastActivityDate: DateTime;
}
```

**Responsibilities**
- Aggregate progress across missions and goals
- Calculate learning velocity
- Track streaks and milestones
- Maintain progress history
- Support progress queries for UI/analytics

**Constraints**
- Progress is calculated from events, not directly stored
- No commands modify external state (all via events)

---

### 7. Achievement Service

**Purpose**: Manages achievements, badges, and awards.

**Owned Data**
- Achievements
- Achievement definitions
- Unlock criteria
- Learner achievement history

**Interface**

```typescript
interface IAchievementService {
  // Queries
  getAchievement(achievementId: UUID): Promise<Achievement>;
  getLearnerAchievements(learnerId: UUID): Promise<Achievement[]>;
  getAchievementsByType(type: AchievementType): Promise<Achievement[]>;
  checkAchievementUnlock(learnerId: UUID, achievementId: UUID): Promise<boolean>;
  getAvailableAchievements(learnerId: UUID): Promise<Achievement[]>;
  
  // Commands
  createAchievement(input: CreateAchievementInput): Promise<Achievement>;
  unlockAchievement(learnerId: UUID, achievementId: UUID, reason: string): Promise<void>;
  
  // Queries for unlock criteria evaluation
  evaluateUnlockCriteria(learnerId: UUID): Promise<AchievementToUnlock[]>;
  
  // Events produced
  // - AchievementUnlocked
  // - StreakMilestoneReached
  
  // Events consumed
  // - MissionCompleted
  // - GoalAchieved
  // - CompetencyUpdated
}

interface CreateAchievementInput {
  title: string;
  description: string;
  achievementType: AchievementType;
  icon: string;
  unlockCriteria: UnlockCriteria;
  rarityTier: RarityTier;
  creditsAwarded: number;
}

interface AchievementToUnlock {
  achievementId: UUID;
  triggerEvent: DomainEvent;
  unlockScore: number; // Confidence 0-100
}
```

**Responsibilities**
- Define achievement types
- Evaluate unlock criteria
- Award achievements
- Manage achievement visibility/sharing
- Track achievement statistics

**Constraints**
- Achievement definitions created by admins
- Cannot modify already-unlocked achievements

---

### 8. Knowledge Service

**Purpose**: Models and updates learner knowledge state.

**Owned Data**
- Competencies
- Knowledge gaps
- Skill assessments
- Learning velocity

**Interface**

```typescript
interface IKnowledgeService {
  // Queries
  getKnowledgeState(learnerId: UUID): Promise<KnowledgeState>;
  getCompetency(learnerId: UUID, skillId: UUID): Promise<Competency>;
  getKnowledgeGaps(learnerId: UUID): Promise<KnowledgeGap[]>;
  getSkillLevel(learnerId: UUID, skillId: UUID): Promise<number>;
  
  // Commands
  updateCompetency(
    learnerId: UUID,
    skillId: UUID,
    newLevel: number,
    method: AssessmentMethod
  ): Promise<Competency>;
  
  detectGaps(learnerId: UUID, requiredSkills: UUID[]): Promise<KnowledgeGap[]>;
  
  // Estimation API
  // Can infer skills from others
  inferCompetency(learnerId: UUID, skillId: UUID): Promise<number>;
  
  // Events produced
  // - CompetencyUpdated
  // - KnowledgeGapDetected
  
  // Events consumed
  // - AssessmentPassed
  // - AssessmentFailed
  // - MissionCompleted
  // - GoalCreated (detect needed skills)
}

interface AssessmentMethod {
  method: 'quiz' | 'project' | 'ai-evaluation' | 'self-report' | 'inference';
  confidence: number; // 0-100
}
```

**Responsibilities**
- Maintain accurate knowledge state
- Update competencies based on assessments
- Detect and track knowledge gaps
- Support skill-to-skill inference
- Guide recommendation engine

**Constraints**
- Competency updates only via assessments or events
- Must handle incomplete information gracefully

---

### 9. Assessment Service

**Purpose**: Manages assessments and evaluation.

**Owned Data**
- Assessment definitions
- Assessment attempts
- Assessment results
- Rubrics

**Interface**

```typescript
interface IAssessmentService {
  // Queries
  getAssessment(assessmentId: UUID): Promise<Assessment>;
  getAssessmentsByMission(missionId: UUID): Promise<Assessment[]>;
  getAttempts(learnerId: UUID, assessmentId: UUID): Promise<AssessmentAttempt[]>;
  getResults(learnerId: UUID): Promise<AssessmentResult[]>;
  
  // Commands
  submitAssessment(
    learnerId: UUID,
    assessmentId: UUID,
    answers: Answer[]
  ): Promise<AssessmentResult>;
  
  scoreAssessment(
    assessmentId: UUID,
    answers: Answer[]
  ): Promise<ScoringResult>;
  
  // Grading strategies (multiple backends)
  registerGrader(type: AssessmentType, grader: Grader): void;
  
  // Events produced
  // - AssessmentAttempted
  // - AssessmentPassed
  // - AssessmentFailed
  
  // Events consumed
  // None (root service)
}

interface Grader {
  name: string;
  grade(assessment: Assessment, answers: Answer[]): Promise<GradeResult>;
}

interface GradeResult {
  score: number; // 0-100
  passed: boolean;
  feedback: string;
  skillsVerified?: UUID[];
}
```

**Responsibilities**
- Manage assessment content
- Support multiple assessment types
- Score assessments
- Generate feedback
- Track assessment history

**Constraints**
- Assessment grading can be synchronous or asynchronous
- Multiple grading strategies (rule-based, AI-based)

---

### 10. AI Provider Service (Abstract)

**Purpose**: Abstracts AI provider dependencies (Claude, OpenAI, Gemini, etc.).

**Owned Data**
- Provider configurations
- API keys
- Usage tracking

**Interface**

```typescript
interface IAIProvider {
  // Core methods
  generateCompletion(prompt: string, context: AIContext): Promise<string>;
  generateExplanation(concept: string, difficulty: Difficulty): Promise<string>;
  scoreEssay(essay: string, rubric: Rubric): Promise<Score>;
  
  // AI-specific capabilities
  generateMissionRecommendation(context: RecommendationContext): Promise<Recommendation>;
  analyzeLearningStyle(learnerId: UUID): Promise<LearnerStyleAnalysis>;
  generateCareerAdvice(profile: LearnerProfile, goals: Goal[]): Promise<Advice>;
}

interface AIContext {
  learnerId: UUID;
  goalId?: UUID;
  missionId?: UUID;
  conversationHistory?: Message[];
  learnerKnowledge?: KnowledgeState;
}

// Concrete implementations (pluggable)
class ClaudeAIProvider implements IAIProvider { ... }
class OpenAIProvider implements IAIProvider { ... }
class GeminiProvider implements IAIProvider { ... }

// Factory
interface IAIProviderFactory {
  createProvider(type: 'claude' | 'openai' | 'gemini'): IAIProvider;
  getActiveProvider(): IAIProvider;
  setActiveProvider(type: string): void;
}
```

**Responsibilities**
- Abstract provider differences
- Handle API calls safely
- Implement rate limiting
- Track usage and costs
- Fall back gracefully
- Enable provider switching

**Constraints**
- Engine never directly imports provider SDKs
- All AI calls go through this service
- Easy to test with mock providers

---

## Service Communication Patterns

### 1. Synchronous (Request/Response)

Services call other services when they need immediate data:

```typescript
// Good: Query-time, low latency needed
async generateRecommendations(learnerId: UUID) {
  const knowledgeState = await knowledgeService.getKnowledgeState(learnerId);
  const goals = await goalService.getLearnerGoals(learnerId);
  const paths = await learningPathService.getLearnerLearningPaths(learnerId);
  
  return engine.recommend(knowledgeState, goals, paths);
}
```

### 2. Asynchronous (Event-Driven)

Services react to events from other services:

```typescript
// Good: Fire-and-forget updates
eventBus.on('MissionCompleted', async (event) => {
  // Update progress
  await progressService.updateMissionProgress(event.data.learnerId, event.data.missionId);
  
  // Update knowledge
  await knowledgeService.updateCompetencies(event.data.learnerId, event.data.skillsAcquired);
  
  // Check achievements
  const achievements = await achievementService.evaluateUnlockCriteria(event.data.learnerId);
  achievements.forEach(a => emit(AchievementUnlockedEvent));
  
  // Update path
  await learningPathService.updateMissionStatus(event.data.learnerId, 'completed');
});
```

### 3. Saga Pattern (Multi-Service Transactions)

Complex workflows orchestrated through events:

```typescript
// When a Goal is created:
// 1. GoalService emits GoalCreated
// 2. KnowledgeService listens, detects gaps
// 3. RecommendationEngine ranks missions
// 4. LearningPathService generates path
// 5. LearningPathService emits LearningPathGenerated
// 6. Each creates appropriate follow-up events

// Ensures eventual consistency without tight coupling
```

---

## Service Dependencies

```
LearnerService          (root, no dependencies)
    ↓
GoalService            (depends on: LearnerService via queries)
    ↓
KnowledgeService       (depends on: none, reacts to events)
    ↓
RecommendationEngine   (depends on: GoalService, KnowledgeService, MissionService)
    ↓
LearningPathService    (depends on: RecommendationEngine, MissionService)
    ↓
ProgressService        (depends on: none, reacts to all events)
    ↓
AchievementService     (depends on: none, reacts to events)
    ↓
AssessmentService      (root, no dependencies)
    ↓
AIProviderService      (abstract, pluggable, no dependencies)
```

**Note**: Services should only have read-only queries for other services, no direct state modification.

---

## Service Deployment

Services can be deployed:

1. **Monolithic** (single process, all services)
2. **Modular** (each service separate Node.js process)
3. **Microservices** (each service own container/cluster)

The interface design supports all topologies.

---

**Next Document**: STATE_MACHINE.md  
**Status**: Ready for review
