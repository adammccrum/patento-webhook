# LAO Intelligence Engine — Event Catalog

**Status**: Architecture Design  
**Version**: 1.0  
**Last Updated**: 2024-07-31

---

## Overview

The LAO Intelligence Engine is event-driven. Every meaningful action in the learner's journey emits an event. The engine reacts by:
- Updating domain state
- Triggering recommendations
- Unlocking missions
- Awarding achievements
- Notifying the learner

Events form an immutable audit trail and enable reactive, loosely-coupled components.

---

## Event Structure

All events follow this base structure:

```typescript
interface DomainEvent {
  // Identity
  eventId: UUID;
  eventType: string; // e.g., 'UserOnboarded', 'MissionCompleted'
  version: number; // Event schema version
  
  // Causality
  aggregateId: UUID; // The entity this event concerns (usually learnerId)
  aggregateType: string; // 'Learner', 'Mission', etc.
  causedBy: {
    userId: UUID; // Who triggered this (could be system)
    action: string; // 'user-action' | 'system-rule' | 'ai-decision'
    timestamp: DateTime;
  }
  
  // Payload (specific to event type)
  data: EventPayload;
  
  // Tracking
  timestamp: DateTime;
  tenantId: UUID;
  correlationId: UUID; // Links related events
  
  // Metadata
  metadata: {
    source: 'web' | 'mobile' | 'api' | 'system';
    ipAddress?: string;
    userAgent?: string;
    version: string; // LAO version
  }
}
```

---

## Event Categories

Events are organized by domain area:

1. **Learner Lifecycle Events** (onboarding, preferences, deactivation)
2. **Goal Events** (creation, updates, achievement)
3. **Learning Path Events** (generation, reordering, completion)
4. **Mission Events** (unlock, start, complete, abandon)
5. **Assessment Events** (attempt, pass, fail)
6. **Achievement Events** (unlock, award)
7. **Knowledge Events** (competency update, gap detection)
8. **AI Events** (conversation start, recommendation)
9. **System Events** (regeneration, cleanup, migration)

---

## 1. Learner Lifecycle Events

### UserOnboarded

Fired when a new learner completes the onboarding flow.

```typescript
interface UserOnboardedEvent extends DomainEvent {
  eventType: 'UserOnboarded';
  data: {
    learnerId: UUID;
    email: string;
    name: string;
    learningStyle: string;
    pacePreference: string;
    availableHoursPerWeek: number;
    timezone: string;
    preferredLanguage: string;
  }
}

// Reactions:
// 1. Initialize KnowledgeState
// 2. Create default onboarding achievement
// 3. Start learner onboarding quest
// 4. Send welcome email
```

### LearnerPreferencesUpdated

Fired when learner changes preferences.

```typescript
interface LearnerPreferencesUpdatedEvent extends DomainEvent {
  eventType: 'LearnerPreferencesUpdated';
  data: {
    learnerId: UUID;
    changes: {
      field: string; // 'pacePreference', 'learningStyle', etc.
      oldValue: unknown;
      newValue: unknown;
    }[]
  }
}

// Reactions:
// 1. Invalidate cached learning path recommendations
// 2. Adjust mission difficulty if needed
// 3. Update future recommendations
```

### LearnerDeactivated

Fired when learner deactivates or is suspended.

```typescript
interface LearnerDeactivatedEvent extends DomainEvent {
  eventType: 'LearnerDeactivated';
  data: {
    learnerId: UUID;
    reason: 'user-request' | 'inactivity' | 'policy-violation' | 'account-deletion';
    deactivatedAt: DateTime;
  }
}

// Reactions:
// 1. Cancel active missions
// 2. Pause learning paths
// 3. Suspend achievement unlocks
// 4. Archive learning data
```

---

## 2. Goal Events

### GoalCreated

Fired when learner creates a new goal.

```typescript
interface GoalCreatedEvent extends DomainEvent {
  eventType: 'GoalCreated';
  data: {
    learnerId: UUID;
    goalId: UUID;
    title: string;
    description: string;
    goalType: 'skill' | 'certification' | 'career' | 'personal' | 'academic';
    category: string;
    targetValue: number;
    targetUnit: string;
    deadline: DateTime | null;
    priority: number; // 1-5
  }
}

// Reactions:
// 1. Trigger recommendation engine (find relevant missions)
// 2. Analyze knowledge gaps
// 3. Generate initial learning path
// 4. Emit LearningPathGenerated event
```

### GoalUpdated

Fired when learner modifies goal details.

```typescript
interface GoalUpdatedEvent extends DomainEvent {
  eventType: 'GoalUpdated';
  data: {
    learnerId: UUID;
    goalId: UUID;
    changes: {
      field: string;
      oldValue: unknown;
      newValue: unknown;
    }[]
  }
}

// Reactions:
// 1. Recalculate learning path if goal changed significantly
// 2. Notify learner if deadlines changed
// 3. Update achievement criteria if applicable
```

### GoalAchieved

Fired when learner reaches goal completion criteria.

```typescript
interface GoalAchievedEvent extends DomainEvent {
  eventType: 'GoalAchieved';
  data: {
    learnerId: UUID;
    goalId: UUID;
    achievedAt: DateTime;
    finalProgress: number; // 0-100
    missionsCompleted: number;
    totalTimeHours: number;
    certificate?: {
      certificateId: UUID;
      issuedAt: DateTime;
    }
  }
}

// Reactions:
// 1. Award achievement (certificate)
// 2. Award credits
// 3. Unlock advanced goals
// 4. Send celebration email
// 5. Generate next recommendations
```

### GoalAbandoned

Fired when learner abandons a goal.

```typescript
interface GoalAbandonedEvent extends DomainEvent {
  eventType: 'GoalAbandoned';
  data: {
    learnerId: UUID;
    goalId: UUID;
    reason: 'user-request' | 'inactivity' | 'too-difficult' | 'time-constraint';
    abandonedAt: DateTime;
    progressAtAbandonment: number; // 0-100
  }
}

// Reactions:
// 1. Pause associated learning path
// 2. Allow goal restart later
// 3. Update goal recommendations
```

---

## 3. Learning Path Events

### LearningPathGenerated

Fired when recommendation engine creates a new learning path.

```typescript
interface LearningPathGeneratedEvent extends DomainEvent {
  eventType: 'LearningPathGenerated';
  data: {
    learnerId: UUID;
    pathId: UUID;
    primaryGoalId: UUID;
    missions: {
      missionId: UUID;
      sequence: number;
      estimatedDurationHours: number;
      unlockCriteria: string;
    }[];
    totalEstimatedHours: number;
    estimatedCompletionDate: DateTime;
    efficiency: number; // 0-100, how optimized
    generationStrategy: 'goal-driven' | 'skill-driven' | 'interest-driven';
  }
}

// Reactions:
// 1. Persist path to database
// 2. Unlock first mission(s)
// 3. Notify learner of path
// 4. Schedule follow-up check-ins
```

### LearningPathReordered

Fired when engine reorders missions in path based on new information.

```typescript
interface LearningPathReorderedEvent extends DomainEvent {
  eventType: 'LearningPathReordered';
  data: {
    learnerId: UUID;
    pathId: UUID;
    reason: 'learner-progress' | 'knowledge-update' | 'goal-change' | 'performance-analysis';
    changes: {
      missionId: UUID;
      oldSequence: number;
      newSequence: number;
    }[];
    regeneratedAt: DateTime;
  }
}

// Reactions:
// 1. Update path in database
// 2. Notify learner if current mission moved
// 3. Adjust mission unlocks
// 4. Log efficiency change
```

### LearningPathCompleted

Fired when all missions in path are completed.

```typescript
interface LearningPathCompletedEvent extends DomainEvent {
  eventType: 'LearningPathCompleted';
  data: {
    learnerId: UUID;
    pathId: UUID;
    primaryGoalId: UUID;
    completedAt: DateTime;
    totalTimeHours: number;
    missionCount: number;
    avgComprehensionScore: number; // 0-100
    avgTimePerMission: number;
    efficiency: number; // Planned vs actual hours
  }
}

// Reactions:
// 1. Award path completion achievement
// 2. Award credits
// 3. Trigger goal completion check
// 4. Generate next learning path if goals remain
```

---

## 4. Mission Events

### MissionUnlocked

Fired when mission becomes available for learner to start.

```typescript
interface MissionUnlockedEvent extends DomainEvent {
  eventType: 'MissionUnlocked';
  data: {
    learnerId: UUID;
    missionId: UUID;
    unlockedAt: DateTime;
    unlockReason: 'prerequisite-completed' | 'goal-relevant' | 'path-position' | 'skill-level';
    estimatedDurationHours: number;
    difficulty: string;
  }
}

// Reactions:
// 1. Mark mission as available in UI
// 2. Send mission unlock notification
// 3. Log for analytics
```

### MissionStarted

Fired when learner begins a mission.

```typescript
interface MissionStartedEvent extends DomainEvent {
  eventType: 'MissionStarted';
  data: {
    learnerId: UUID;
    missionId: UUID;
    startedAt: DateTime;
    estimatedCompletionDate: DateTime;
  }
}

// Reactions:
// 1. Start progress tracking
// 2. Begin time-on-task measurement
// 3. Update learner's active mission count
```

### LessonCompleted

Fired when learner finishes a lesson.

```typescript
interface LessonCompletedEvent extends DomainEvent {
  eventType: 'LessonCompleted';
  data: {
    learnerId: UUID;
    missionId: UUID;
    lessonId: UUID;
    completedAt: DateTime;
    timeSpentMinutes: number;
    paceRating: number; // 1-5, too fast to too slow
  }
}

// Reactions:
// 1. Update mission progress
// 2. Adjust learning velocity
// 3. Update estimated completion date
// 4. Check for mission completion
```

### MissionCompleted

Fired when learner successfully completes all mission requirements.

```typescript
interface MissionCompletedEvent extends DomainEvent {
  eventType: 'MissionCompleted';
  data: {
    learnerId: UUID;
    missionId: UUID;
    completedAt: DateTime;
    totalTimeHours: number;
    assessmentScore: number; // 0-100
    skillsAcquired: {
      skillId: UUID;
      skillName: string;
      levelAchieved: number; // 0-100
    }[];
    nextMissionsUnlocked: UUID[];
    creditsAwarded: number;
  }
}

// Reactions:
// 1. Award credits
// 2. Update KnowledgeState with new competencies
// 3. Check achievement unlock criteria
// 4. Unlock next missions in path
// 5. Update goal progress
// 6. Trigger recommendation update
// 7. Check for path completion
```

### MissionAbandoned

Fired when learner gives up on a mission.

```typescript
interface MissionAbandonedEvent extends DomainEvent {
  eventType: 'MissionAbandoned';
  data: {
    learnerId: UUID;
    missionId: UUID;
    reason: 'user-request' | 'too-difficult' | 'time-constraint' | 'topic-change' | 'inactivity';
    progressPercentage: number;
    timeSpentHours: number;
    abandonedAt: DateTime;
  }
}

// Reactions:
// 1. Pause mission
// 2. Allow restart later
// 3. If due to difficulty, recommend alternative missions
// 4. Update learning path if needed
```

---

## 5. Assessment Events

### AssessmentAttempted

Fired when learner submits an assessment.

```typescript
interface AssessmentAttemptedEvent extends DomainEvent {
  eventType: 'AssessmentAttempted';
  data: {
    learnerId: UUID;
    assessmentId: UUID;
    lessonId: UUID;
    missionId: UUID;
    attemptNumber: number;
    score: number; // 0-100
    passed: boolean;
    timeSpentMinutes: number;
    attemptedAt: DateTime;
  }
}

// Reactions:
// 1. Store result
// 2. Update competency estimate if passed
// 3. If failed, recommend review or alternative
// 4. Award effort credits
```

### AssessmentPassed

Fired when learner passes an assessment.

```typescript
interface AssessmentPassedEvent extends DomainEvent {
  eventType: 'AssessmentPassed';
  data: {
    learnerId: UUID;
    assessmentId: UUID;
    missionId: UUID;
    score: number; // 0-100
    skillsVerified: UUID[];
    creditsAwarded: number;
    passedAt: DateTime;
  }
}

// Reactions:
// 1. Unlock next lesson or mark mission section complete
// 2. Update KnowledgeState competencies
// 3. Award credits
// 4. Check mission completion
```

### AssessmentFailed

Fired when learner fails an assessment.

```typescript
interface AssessmentFailedEvent extends DomainEvent {
  eventType: 'AssessmentFailed';
  data: {
    learnerId: UUID;
    assessmentId: UUID;
    missionId: UUID;
    score: number;
    attemptNumber: number;
    failedAt: DateTime;
  }
}

// Reactions:
// 1. Recommend review materials
// 2. Offer alternative explanations (via AI)
// 3. Allow retry after cooldown
// 4. If repeated failures, suggest skill prerequisites
```

---

## 6. Achievement Events

### AchievementUnlocked

Fired when learner meets criteria for an achievement.

```typescript
interface AchievementUnlockedEvent extends DomainEvent {
  eventType: 'AchievementUnlocked';
  data: {
    learnerId: UUID;
    achievementId: UUID;
    achievementType: 'badge' | 'certificate' | 'milestone' | 'streak';
    title: string;
    description: string;
    unlockedAt: DateTime;
    criteria: {
      type: string;
      details: unknown;
    };
    creditsAwarded: number;
    rarityTier: string;
    percentOfLearnersWithAchievement: number;
  }
}

// Reactions:
// 1. Notify learner immediately (push, email)
// 2. Display achievement celebration
// 3. Award credits
// 4. Update profile/leaderboard
// 5. Check for combo achievements
```

### StreakMilestoneReached

Fired when learner reaches a learning streak milestone.

```typescript
interface StreakMilestoneReachedEvent extends DomainEvent {
  eventType: 'StreakMilestoneReached';
  data: {
    learnerId: UUID;
    currentStreak: number; // days
    milestone: number; // 7, 14, 30, 60, 100, etc.
    reachedAt: DateTime;
    bonus: {
      creditsAwarded: number;
      achievementUnlocked: UUID | null;
    }
  }
}

// Reactions:
// 1. Award streak bonus credits
// 2. Send celebration notification
// 3. Suggest extended learning session
```

---

## 7. Knowledge Events

### CompetencyUpdated

Fired when learner's competency level in a skill changes.

```typescript
interface CompetencyUpdatedEvent extends DomainEvent {
  eventType: 'CompetencyUpdated';
  data: {
    learnerId: UUID;
    skillId: UUID;
    skillName: string;
    oldLevel: number; // 0-100
    newLevel: number; // 0-100
    confidence: number; // How sure system is
    updatedBy: 'mission-completion' | 'assessment' | 'ai-evaluation' | 'self-report';
    updatedAt: DateTime;
  }
}

// Reactions:
// 1. Update KnowledgeState
// 2. Trigger recommendation update if skill was blocking
// 3. Check skill mastery achievement
// 4. Suggest advanced missions if now expert
```

### KnowledgeGapDetected

Fired when engine identifies a skill the learner needs but lacks.

```typescript
interface KnowledgeGapDetectedEvent extends DomainEvent {
  eventType: 'KnowledgeGapDetected';
  data: {
    learnerId: UUID;
    skillId: UUID;
    skillName: string;
    detectedDuringMission?: UUID; // Mission that revealed the gap
    detectionMethod: 'goal-analysis' | 'mission-requirement' | 'assessment-failure' | 'ai-evaluation';
    priority: number; // 1-10
    detectedAt: DateTime;
  }
}

// Reactions:
// 1. Add to KnowledgeState gaps
// 2. Recommend prerequisite missions
// 3. May trigger learning path reordering
// 4. Alert if gap is high-priority
```

---

## 8. AI Events

### AIConversationStarted

Fired when learner initiates AI-assisted learning.

```typescript
interface AIConversationStartedEvent extends DomainEvent {
  eventType: 'AIConversationStarted';
  data: {
    learnerId: UUID;
    conversationId: UUID;
    missionId?: UUID;
    context: 'lesson-help' | 'assessment-help' | 'general-question' | 'career-advice';
    startedAt: DateTime;
    aiProvider: 'claude' | 'gpt-4' | 'gemini' | 'other'; // Abstracted
  }
}

// Reactions:
// 1. Log for analytics
// 2. Track AI usage for credits
// 3. Update learner engagement metric
```

### AIRecommendationMade

Fired when AI provides a recommendation.

```typescript
interface AIRecommendationMadeEvent extends DomainEvent {
  eventType: 'AIRecommendationMade';
  data: {
    learnerId: UUID;
    recommendationType: 'next-mission' | 'study-materials' | 'alternative-approach' | 'career-path';
    recommendation: {
      title: string;
      description: string;
      confidence: number; // 0-100
    };
    basedOnData: {
      goals: UUID[];
      recentCompletions: UUID[];
      knowledgeGaps: UUID[];
    };
    madeAt: DateTime;
  }
}

// Reactions:
// 1. Present recommendation to learner
// 2. Track if recommendation was accepted
// 3. Use for AI quality feedback loop
```

### AIConversationCompleted

Fired when AI-assisted learning session ends.

```typescript
interface AIConversationCompletedEvent extends DomainEvent {
  eventType: 'AIConversationCompleted';
  data: {
    learnerId: UUID;
    conversationId: UUID;
    messageCount: number;
    durationMinutes: number;
    completedAt: DateTime;
    creditsUsed: number;
    learnerFeedback?: {
      helpful: boolean;
      rating: 1-5;
    };
  }
}

// Reactions:
// 1. Update credits balance
// 2. Log learning engagement
// 3. Collect feedback for AI improvement
```

---

## 9. System Events

### LearningPathRecommendationTriggered

Fired when system decides to regenerate recommendations.

```typescript
interface LearningPathRecommendationTriggeredEvent extends DomainEvent {
  eventType: 'LearningPathRecommendationTriggered';
  data: {
    learnerId: UUID;
    reason: 'scheduled-check' | 'significant-progress' | 'goal-added' | 'knowledge-update' | 'performance-analysis';
    triggeredAt: DateTime;
    lastRecommendationAt: DateTime;
  }
}

// Reactions:
// 1. Call recommendation engine
// 2. Compare old vs new path
// 3. If significantly different, emit LearningPathReordered
```

### BatchProcessingCompleted

Fired when nightly/periodic batch jobs finish.

```typescript
interface BatchProcessingCompletedEvent extends DomainEvent {
  eventType: 'BatchProcessingCompleted';
  data: {
    batchType: 'daily-recommendations' | 'weekly-summary' | 'achievement-check' | 'analytics-aggregation';
    processedCount: number;
    updatedCount: number;
    completedAt: DateTime;
    duration: number; // milliseconds
  }
}

// Reactions:
// 1. Log processing metrics
// 2. Trigger follow-up jobs
// 3. Alert if processing took too long
```

---

## Event Flow Example

**Scenario**: Learner creates a goal, completes a mission, unlocks an achievement.

```
1. UserOnboarded
   ↓ (init state)
2. GoalCreated
   ↓ (recommend missions)
3. LearningPathGenerated
   ↓ (unlock first mission)
4. MissionUnlocked
   ↓ (learner starts)
5. MissionStarted
   ↓ (completes lessons)
6. LessonCompleted (multiple)
   ↓ (completes assessments)
7. AssessmentAttempted → AssessmentPassed (multiple)
   ↓ (mission complete)
8. MissionCompleted
   ↓ (competency up)
9. CompetencyUpdated
   ↓ (gap filled)
10. KnowledgeGapDetected (resolved)
    ↓ (achievement unlock)
11. AchievementUnlocked
    ↓ (path progress)
12. LearningPathReordered (optional, if goals changed)
```

---

## Event Storage and Replay

Events are:
- **Immutable**: Never modified once stored
- **Ordered**: By timestamp and sequence number
- **Auditable**: Complete history available
- **Replayable**: System state can be rebuilt from events
- **Searchable**: Indexed by learner, aggregate type, event type

This enables:
- Audit trails
- Analytics
- Debugging
- Time-travel queries
- Event sourcing (if implemented)

---

**Next Document**: SERVICE_INTERFACES.md  
**Status**: Ready for review
