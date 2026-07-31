# Phase 3: Domain Model & Type System

## Core Domain Types

### Knowledge Graph

```typescript
// Node in the knowledge graph
export interface KnowledgeNode {
  id: string;  // UUID
  type: 'skill' | 'concept' | 'topic' | 'technology' | 'mission' | 'goal' | 
        'assessment' | 'project' | 'certificate' | 'resource' | 'conversation';
  title: string;
  description: string;
  metadata?: {
    difficulty?: 0-100;
    category?: string;
    tags?: string[];
    externalUrl?: string;
  };
  createdAt: string;  // ISO 8601
  updatedAt: string;
}

// Relationship in the knowledge graph
export interface KnowledgeEdge {
  id: string;  // UUID
  fromNodeId: string;
  toNodeId: string;
  relationshipType: 
    | 'teaches'              // Mission teaches Skill
    | 'requires'             // Skill requires prerequisite Skill
    | 'depends_on'           // Concept depends on Concept
    | 'strengthens'          // Practice strengthens Skill
    | 'related_to'           // Concepts are related
    | 'completed_by'         // Skill completed by Mission
    | 'assessed_by'          // Skill assessed by Assessment
    | 'recommended_after';   // Action recommended after another
  
  weight: 0-100;  // Strength: 100 = strong relationship, 20 = weak connection
  
  metadata?: {
    requiredMasteryLevel?: 0-100;  // For 'requires' edges
    estimatedHours?: number;        // For learning paths
    difficulty?: 0-100;
  };
  
  createdAt: string;
  updatedAt: string;
}

// The learner's knowledge graph
export interface LearnerKnowledgeGraph {
  learnerId: string;
  tenantId: string;
  
  // All skills/concepts learner has encountered
  nodes: KnowledgeNode[];
  
  // Relationships between them
  edges: KnowledgeEdge[];
  
  // Timestamps
  createdAt: string;
  lastModifiedAt: string;
  lastAnalyzedAt?: string;  // When graph was last analyzed for gaps
}
```

---

## KnowledgeState Aggregate

```typescript
// Evidence of learning (assessment, mission, project, etc.)
export interface LearningEvidence {
  id: string;  // UUID
  type: 'assessment' | 'mission' | 'project' | 'exercise' | 'conversation' | 'real-world-task';
  title: string;
  
  // Result
  passed: boolean;
  score?: 0-100;  // Percentage correct
  timeSpentMinutes: number;
  
  // When
  completedAt: string;  // ISO 8601
  
  // Context
  actionType?: 'learn' | 'practice' | 'apply' | 'master' | 'reinforce';
  notes?: string;
}

// A misconception about this skill
export interface Misconception {
  id: string;  // UUID
  skillId: string;
  
  description: string;  // "thinks recursion requires a helper function"
  
  // When discovered
  discoveredAt: string;
  discoveredVia: 'assessment' | 'conversation' | 'exercise' | 'question';
  
  // Correction
  correctedAt?: string;
  correctionMethod?: string;  // "worked through example", "watched video"
  
  // Impact
  affectedMissionIds: string[];  // Missions this misconception affected
  affectedDownstreamSkills: string[];  // Skills that depend on this skill
}

// Mastery state for a single skill
export interface KnowledgeState {
  id: string;  // UUID
  learnerId: string;
  skillId: string;
  tenantId: string;
  
  // === MASTERY LEVEL ===
  masteryLevel: 0-100;  // Overall percentage
  masteryStage: 
    | 'unfamiliar'    // 0-20: Never attempted
    | 'aware'         // 20-40: Knows concepts
    | 'developing'    // 40-70: Can apply with help
    | 'proficient'    // 70-90: Can apply independently
    | 'expert';       // 90-100: Can teach others
  
  // === CONFIDENCE ===
  confidence: 'low' | 'medium' | 'high';  // Calibrated against assessment results
  confidenceScore: 0-100;  // Numerical version
  
  // === EVIDENCE ===
  evidence: LearningEvidence[];
  
  // Recent performance
  successRate: 0-100;  // % of recent assessments passed (last 10)
  recentScore?: 0-100;  // Most recent assessment score
  
  // === MISCONCEPTIONS ===
  misconceptions: Misconception[];
  
  // === TEMPORAL ===
  firstLearnedAt: string;  // When learner first encountered this skill
  lastPracticedAt: string;  // When last action on this skill
  lastAssessedAt?: string;  // When last formally assessed
  
  // Spaced repetition
  nextReviewAt: string;  // When learner should review this skill
  reviewSchedule: {
    lastReviewAt: string;
    reviewCount: number;
    daysSinceLast: number;
  };
  
  // Forgetting curve (Ebbinghaus)
  forgettingCurve: 0-100;  // % retention without practice (100 = perfect retention)
  estimatedRetentionHalfLife: number;  // Days until 50% forgotten
  
  // === PREREQUISITES ===
  prerequisites: {
    skillId: string;
    skillTitle: string;
    requiredMasteryLevel: 0-100;
    learnerMasteryLevel: 0-100;
    metAt?: string;  // When prerequisite was met
  }[];
  
  prerequisitesMet: boolean;  // Can learner learn this skill?
  prerequisitesNotMet: string[];  // Which prerequisites are missing
  
  // === DEPENDENTS ===
  dependentSkills: string[];  // What becomes available when this skill is mastered
  dependentsReady: string[];  // Which dependents learner is ready for
  
  // === PERFORMANCE ===
  averageTimeToMastery: number;  // Hours spent learning this skill so far
  estimatedTimeToExpertise: number;  // Hours needed to reach 100%
  learningVelocity: number;  // Percentage points per week
  
  // === STREAKS ===
  currentPracticeStreak: number;  // Consecutive days of practice
  longestPracticeStreak: number;
  
  // === METADATA ===
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;  // Soft delete support
}

// Read model: simplified snapshot for queries
export interface SkillMasterySnapshot {
  skillId: string;
  learnerId: string;
  
  masterySummary: {
    level: string;  // unfamiliar, aware, developing, proficient, expert
    percentage: 0-100;
  };
  
  readinessForDependent: {
    skillId: string;
    ready: boolean;
    reason: string;  // "requires 70% mastery, learner at 65%"
  }[];
  
  recentEvidence: LearningEvidence[];
  
  needsReview: boolean;  // nextReviewAt < now
  
  misconceptionsToBecomeAware: Misconception[];
}
```

---

## LearnerMemory Aggregate

```typescript
// A single recorded learning session
export interface SessionRecord {
  id: string;
  timestamp: string;  // ISO 8601
  
  skillId: string;
  actionType: 'lesson' | 'quiz' | 'project' | 'exercise' | 'revision' | 'conversation' | 'real-world-task';
  
  outcome: 'success' | 'partial' | 'failure';
  score?: 0-100;
  duration: number;  // minutes
  
  notes?: string;
  contextNotes?: string;  // E.g., "was tired", "worked with team"
}

// A pattern in learner's mistakes
export interface RecurringMistake {
  id: string;
  skillId: string;
  
  pattern: string;  // E.g., "forgets to handle null cases"
  frequency: number;  // How many times seen
  
  firstOccurredAt: string;
  lastOccurredAt: string;
  
  correctionsNeeded: number;
  successfulCorrectionApproaches: string[];  // What worked before
}

// A successful learning strategy learner has used
export interface SuccessfulStrategy {
  skillId: string;
  strategy: string;  // E.g., "break down into smaller steps"
  
  effectiveness: 0-100;
  timesUsedSuccessfully: number;
  
  description?: string;
  applicableToSkills: string[];  // Other skills where this helped
}

// Preference about how learner learns best
export interface LearningPreference {
  preferredPace: 'slow' | 'normal' | 'fast';
  
  preferredLearningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  
  // Explanation styles learner responds to
  preferredExplanations: Array<
    | 'step-by-step'
    | 'big-picture-first'
    | 'analogies'
    | 'code-first'
    | 'visual-diagrams'
    | 'real-world-examples'
    | 'story-based'
    | 'mathematical'
  >;
  
  // Practice style preferences
  preferredPracticeTypes: Array<
    | 'guided-exercises'
    | 'projects'
    | 'quizzes'
    | 'conversations'
    | 'pair-programming'
    | 'code-reviews'
  >;
  
  // Pacing preferences
  preferredSessionLength: 'short' | 'medium' | 'long';  // 15min, 45min, 2hr
  
  // Social preferences
  learnsBetter: 'alone' | 'with-group' | 'either';
}

// Strength identified in learner
export interface Strength {
  skillId: string;
  skillName: string;
  
  description: string;  // E.g., "quickly grasps algorithmic thinking"
  
  evidence: string[];  // E.g., ["completed 5 advanced assessments", "mentor feedback"]
  
  discoveredAt: string;
  developedAt?: string;  // When learner became strong
}

// Weak area identified in learner
export interface WeakArea {
  skillId: string;
  skillName: string;
  
  description: string;  // E.g., "struggles with database modeling"
  reason?: string;  // E.g., "thinks tables are like spreadsheets"
  
  attempts: number;
  lastAttemptedAt: string;
  
  suggestedInterventions: string[];  // E.g., ["visual diagrams", "hands-on project"]
}

// The learner's memory (persistent context)
export interface LearnerMemory {
  id: string;
  learnerId: string;
  tenantId: string;
  
  // === LEARNING PREFERENCES ===
  preferences: LearningPreference;
  preferencesUpdatedAt: string;
  
  // === SESSION HISTORY ===
  // Keep last 50 sessions for pattern analysis
  sessionHistory: SessionRecord[];
  
  // === MISCONCEPTIONS DISCOVERED ===
  discoveredMisconceptions: Misconception[];
  
  // === STRENGTHS ===
  strengths: Strength[];
  
  // === WEAK AREAS ===
  weakAreas: WeakArea[];
  
  // === RECURRING PATTERNS ===
  recurringMistakes: RecurringMistake[];
  recurringSuccesses: SuccessfulStrategy[];
  
  // === CONFIDENCE TRENDS ===
  // Track how confidence changes over time per skill
  confidenceTrends: {
    skillId: string;
    measurements: {
      timestamp: string;
      confidence: 0-100;
      basis: string;  // "assessment", "self-report", "mentor-feedback"
    }[];
  }[];
  
  // === LEARNING VELOCITY TREND ===
  velocityTrend: {
    month: string;  // YYYY-MM
    skillsAcquired: number;
    averageTimePerSkill: number;
    momentum: 0-100;  // 100 = accelerating, 0 = stuck
  }[];
  
  // === METADATA ===
  createdAt: string;
  lastUpdatedAt: string;
  lastSessionAt?: string;
  
  // Compute: total learning time, total assessments, unique skills touched
  stats: {
    totalSessionsRecorded: number;
    totalHoursLearned: number;
    uniqueSkillsLearned: number;
    uniqueSkillsExpert: number;
    totalAssessmentsCompleted: number;
    averageAssessmentScore: 0-100;
  };
}

// Read model: simplified snapshot
export interface MemorySnapshot {
  learnerId: string;
  
  // Quick facts
  learningPattern: string;  // "fast learner", "consistent but slow", "bursty"
  recommendedPace: string;
  
  // What to know about this learner
  keyStrengths: string[];
  keyWeaknesses: string[];
  
  // Avoid in tutoring
  knownMisconceptions: {
    skillId: string;
    misconception: string;
    correctionStrategy: string;
  }[];
  
  // Use in tutoring
  successfulStrategies: {
    description: string;
    effectiveness: 0-100;
  }[];
  
  // Recent activity
  lastLearningSession: string;
  currentMomentum: 0-100;
}
```

---

## Skill Dependency Graph

```typescript
// A prerequisite relationship
export interface PrerequisiteEdge {
  skillId: string;
  prerequisiteSkillId: string;
  
  // How much of prerequisite is needed before learning skill?
  requiredMasteryLevel: 0-100;  // E.g., 70 (learner must reach 70%)
  
  // How this prerequisite supports learning
  supportRole: string;  // E.g., "foundation", "reference", "extension"
  
  // When was prerequisite met?
  metAt?: string;  // Timestamp learner reached required mastery
  
  // Difficulty jump
  difficultyIncrease: 0-100;  // How much harder is skill than prerequisite
}

// A skill's position in mastery path
export interface MasteryMilestone {
  level: 'unfamiliar' | 'aware' | 'developing' | 'proficient' | 'expert';
  percentage: 0-100;
  
  estimatedHoursToReach: number;  // From previous level
  
  capabilities: string[];  // What learner can do at this level
  assessmentTypes: string[];  // How to validate this level
  
  nextMilestone?: {
    level: string;
    percentage: 0-100;
  };
}

// The skill dependency graph for a learner
export interface SkillDependencyGraph {
  learnerId: string;
  skillId: string;
  tenantId: string;
  
  // === PREREQUISITES ===
  prerequisites: PrerequisiteEdge[];
  
  // Check: Are all prerequisites met?
  allPrerequisitesMet: boolean;
  unmetPrerequisites: {
    skillId: string;
    skillTitle: string;
    requiredMastery: 0-100;
    learnerMastery: 0-100;
    hoursToMeet: number;  // Estimate
  }[];
  
  // === MASTERY PATH ===
  masteryPath: MasteryMilestone[];
  
  currentMilestone: MasteryMilestone;
  nextMilestone?: MasteryMilestone;
  
  // === DEPENDENTS (Skills that require this) ===
  dependentSkills: {
    skillId: string;
    skillTitle: string;
    
    requiredMasteryOfThisSkill: 0-100;
    canLearnerLearnNow: boolean;
    
    reasonForDependency: string;
  }[];
  
  // === RELATED (Not prerequisites, but useful) ===
  relatedSkills: {
    skillId: string;
    skillTitle: string;
    relationshipType: 'reinforces' | 'complements' | 'alternative_to' | 'advanced_version_of';
  }[];
  
  // === EVIDENCE OF PREREQUISITES ===
  prerequisiteEvidence: {
    skillId: string;
    evidence: LearningEvidence[];
  }[];
  
  // === MASTERY STATISTICS ===
  stats: {
    learnerDaysLearning: number;
    learnerHoursPracticed: number;
    learnerAssessmentsCompleted: number;
    learnerSuccessRate: 0-100;
  };
  
  createdAt: string;
  updatedAt: string;
}
```

---

## Recommendation Data Structures

```typescript
// A recommended action
export interface RecommendedAction {
  id: string;
  
  // What to do
  actionType: 'mission' | 'project' | 'quiz' | 'conversation' | 'revision' | 'exercise' | 'real-world-task';
  actionId: string;
  actionTitle: string;
  
  // Why this action
  targetSkillIds: string[];  // Which skills this develops
  expectedOutcome: string;  // "Master SQL joins"
  
  reasoning: string;  // "Addresses database design misconception"
  reasoningFactors: {
    factor: string;  // "fills prerequisite gap", "reinforcement needed", "misconception to fix"
    priority: 0-100;
    contribution: 0-100;  // How much this helps
  }[];
  
  // Practicalities
  estimatedHours: number;
  difficulty: 0-100;
  requiredPrerequisites: string[];  // Learner must have these first
  
  // Timing
  urgency: 'low' | 'medium' | 'high' | 'critical';
  optimalTiming: 'now' | 'soon' | 'whenever';
  
  // Context
  relatedToGoal?: string;  // Goal this helps achieve
  relatedToMisconception?: string;
  
  // Quality
  confidence: 0-100;  // How sure are we this is the right action?
  
  // Alternatives
  alternatives: {
    actionId: string;
    actionTitle: string;
    reason: string;  // Why this might be better
    tradeoff: string;  // Cost of choosing this instead
  }[];
}

// Reinforcement action (spaced repetition)
export interface ReinforcementAction extends RecommendedAction {
  skillId: string;
  lastPracticed: string;
  daysSincePractice: number;
  
  reasonForReview: 
    | 'spaced-repetition'  // Ebbinghaus schedule
    | 'accuracy-below-threshold'  // < 80% success rate
    | 'weak-area'  // Learner struggles here
    | 'misconception-discovered'  // Need to fix misunderstanding
    | 'prerequisite-for-next-skill';  // Need to solidify before advancing
  
  reviewUrgency: 'low' | 'medium' | 'high';
}

// Gap analysis result
export interface SkillGap {
  skillId: string;
  skillTitle: string;
  
  // Current vs required
  currentMastery: 0-100;
  requiredMastery: 0-100;
  gap: number;  // required - current
  
  // Prerequisites for this gap
  prerequisitesForGap: {
    skillId: string;
    skillTitle: string;
    learnerMastery: 0-100;
    requiredMastery: 0-100;
  }[];
  
  // How to close
  suggestedActions: RecommendedAction[];
  
  // Timeline
  estimatedHoursToClose: number;
  recommendedPaceHoursPerWeek: number;
  
  // Criticality
  criticality: 'low' | 'medium' | 'high' | 'blocking';  // "blocking" = prevents goal achievement
}

// Complete gap analysis
export interface GoalGapAnalysis {
  goalId: string;
  goalTitle: string;
  learnerId: string;
  
  // Goal requirements
  requiredSkills: {
    skillId: string;
    skillTitle: string;
    requiredMastery: 0-100;
  }[];
  
  // Current state
  acquiredSkills: {
    skillId: string;
    skillTitle: string;
    masterySince: string;
  }[];
  
  // Gaps
  gaps: SkillGap[];
  
  // Action plan
  actionPlan: {
    phase: number;
    name: string;
    skills: string[];
    actions: RecommendedAction[];
    estimatedHoursForPhase: number;
    estimatedDaysToComplete: number;
  }[];
  
  // Summary
  totalGapHours: number;
  totalGapDays: number;  // At recommended pace
  confidence: 0-100;  // How sure we are about this analysis
  
  lastAnalyzedAt: string;
}

// Learning velocity
export interface LearningVelocity {
  learnerId: string;
  
  // Current metrics
  skillsAcquiredThisMonth: number;
  skillsAcquiredThisQuarter: number;
  
  averageTimePerSkill: number;  // Hours
  
  momentum: 0-100;  // 100 = accelerating, 0 = stuck
  trend: 'accelerating' | 'steady' | 'decelerating' | 'stuck';
  
  // Projection
  projectedSkillsByEndOfYear: number;
  
  // Confidence in metrics
  basedOnSessions: number;  // How many sessions analyzed
}
```

---

## Event Types (Phase 3)

```typescript
// Knowledge state events
export const PHASE_3_EVENTS = [
  // Assessment and practice
  'SkillAssessed',           // Assessment taken, score recorded
  'MasteryIncreased',        // Learner improved on skill
  'MasteryDecreased',        // Forgetting detected
  
  // Misconceptions
  'MisconceptionDiscovered', // Learning barrier identified
  'MisconceptionCorrected',  // Feedback applied, misconception addressed
  
  // Prerequisites
  'PrerequisiteMet',         // Learner now ready for dependent skill
  'PrerequisiteGap',         // Learner blocked on prerequisite
  
  // Skills and mastery
  'SkillUnlocked',           // Prerequisites met, skill is available
  'SkillMastered',           // Expert level reached (100%)
  'SkillReviewScheduled',    // Spaced repetition scheduled
  
  // Memory
  'SessionRecorded',         // Learning action recorded
  'StrategyDiscovered',      // Successful approach documented
  'PatternIdentified',       // Recurring mistake or success pattern found
  'PreferenceUpdated',       // Learning preference refined
  
  // Recommendations
  'RecommendationGenerated', // Next action recommended
  'ActionTaken',             // Learner started recommended action
  
  // Analysis
  'GapAnalysisCompleted',    // Goal gap analysis finished
  'LearningVelocityCalculated',
];

// Event: Skill Assessment
export interface SkillAssessedEvent extends DomainEvent {
  eventType: 'SkillAssessed';
  data: {
    learnerId: string;
    skillId: string;
    assessmentId: string;
    score: 0-100;
    timeSpentMinutes: number;
    passed: boolean;
    evidence: string;
  };
}

// Event: Mastery Increased
export interface MasteryIncreasedEvent extends DomainEvent {
  eventType: 'MasteryIncreased';
  data: {
    learnerId: string;
    skillId: string;
    previousMastery: 0-100;
    newMastery: 0-100;
    changeReason: string;  // "assessment passed", "mission completed", etc.
    evidence: string;
  };
}

// Event: Misconception Discovered
export interface MisconceptionDiscoveredEvent extends DomainEvent {
  eventType: 'MisconceptionDiscovered';
  data: {
    learnerId: string;
    skillId: string;
    misconception: string;
    discoveredVia: string;
    affectedAttempts: number;
  };
}

// Event: Session Recorded
export interface SessionRecordedEvent extends DomainEvent {
  eventType: 'SessionRecorded';
  data: {
    learnerId: string;
    skillId: string;
    actionType: string;
    outcome: 'success' | 'partial' | 'failure';
    duration: number;  // minutes
    score?: 0-100;
  };
}
```

---

## Service Contracts

All services follow the Phase 1 pattern:

```typescript
interface IPhase3Service extends IService {
  // All services implement
  health(): Promise<boolean>;
  handleEvent(event: DomainEvent): Promise<void>;
  
  // Service-specific methods
  // (see PHASE_3_ARCHITECTURE.md for details)
}
```

---

## Database Schema Implications (Phase 4)

For Phase 4 Prisma implementation:

```
Entities:
- KnowledgeNode (skill, concept, topic, etc.)
- KnowledgeEdge (relationships)
- KnowledgeState (learner's mastery of each skill)
- LearnerMemory (persistent context)
- Misconception (learning barriers)
- SkillDependencyGraph (prerequisite tracking)
- RecommendedAction (recommendations)

Indexes:
- learnerId + skillId (common queries)
- learnerId + masteryLevel (filtering by proficiency)
- nextReviewAt (spaced repetition scheduling)
- skillId + prerequisiteSkillId (dependency graph queries)

Event Tables:
- KnowledgeStateEvent (all changes to knowledge)
- MemoryEvent (all memory updates)
```

---

## Validation Rules (Invariants)

```typescript
// KnowledgeState invariants
- masteryLevel: 0 <= x <= 100
- confidence: low | medium | high
- confidenceScore: 0 <= x <= 100
- successRate: 0 <= x <= 100
- Cannot have mastery 100 without evidence
- All prerequisites must have evidence
- currentPracticeStreak >= 0
- longestPracticeStreak >= currentPracticeStreak

// LearnerMemory invariants
- sessionHistory.length <= 50 (keep last 50)
- confidence trends cannot jump > 20 points
- totalHoursLearned >= sum(sessionHistory.duration)
- preferredPace must be consistent with actual pace

// SkillDependencyGraph invariants
- prerequisitesMet implies no unmetPrerequisites
- allPrerequisitesMet = (unmetPrerequisites.length == 0)
- dependentSkills cannot be learned until prerequisite mastery reached

// RecommendedAction invariants
- estimatedHours > 0
- difficulty: 0 <= x <= 100
- confidence: 0 <= x <= 100
- urgency must match learning context
```

---

## Integration Points

**Phase 1 ← Phase 3:**
- Events flow up through EventBus
- All Phase 3 changes are events

**Phase 2 ← Phase 3:**
- GoalService sends goals to KnowledgeStateService (extract required skills)
- ProgressService sends mission completions (update skill mastery)
- RecommendationEngine consumes KnowledgeState and Memory

**New ← Phase 3:**
- AI Tutoring Service (Phase 4) consumes Memory + KnowledgeState
- Mobile App consumes Recommendations + Gaps
- Analytics consume Learning Velocity + Trends

