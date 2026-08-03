# LAO Intelligence Engine — State Machines

**Status**: Architecture Design  
**Version**: 1.0  
**Last Updated**: 2024-07-31

---

## Overview

State machines define the valid transitions between states for key domain entities. They prevent invalid state combinations and ensure business rules are enforced.

Each state machine includes:
- Initial state
- Valid transitions
- Terminal states
- Guards (conditions that must be met)
- Actions (side effects)

---

## 1. Learner Lifecycle State Machine

**States**:
- `onboarding` → Initial state
- `active` → Learning engaged
- `paused` → Temporarily inactive
- `inactive` → No activity for 30+ days
- `deactivated` → Intentionally deactivated
- `suspended` → Policy violation

**Transition Diagram**

```
       ┌─────────────┐
       │ onboarding  │
       └──────┬──────┘
              │ (complete onboarding quiz)
              ↓
       ┌─────────────┐
       │   active    │◄─────────────┐
       └──────┬──────┘              │ (resume)
              │                     │
       (30+ days no activity)       │
              │                  ┌──┴──────┐
              ↓                  │  paused  │
       ┌─────────────┐           └──────────┘
       │  inactive   │
       └──────┬──────┘
              │ (user request)
              ↓
       ┌─────────────┐
       │ deactivated │ (terminal)
       └─────────────┘

       (policy violation at any point)
              ↓
       ┌─────────────┐
       │ suspended   │ (terminal)
       └─────────────┘
```

**Guard Conditions**
- Cannot move from `deactivated` → `active` (needs account recovery)
- Cannot move from `suspended` → any other state
- `paused` → `inactive` only after 30 days

**Actions on Entry**
```typescript
onStateEnter(fromState, toState, learner) {
  switch (toState) {
    case 'active':
      // Resume notifications
      notificationService.resume(learner.id);
      // Reset inactivity timer
      break;
      
    case 'paused':
      // Stop notifications
      notificationService.pause(learner.id);
      // Save pause timestamp
      break;
      
    case 'deactivated':
      // Archive active paths
      learningPathService.pauseAll(learner.id);
      // Clear session data
      // Emit LearnerDeactivated event
      break;
      
    case 'suspended':
      // Disable account access
      // Notify compliance
      // Archive data
      break;
  }
}
```

---

## 2. Goal Lifecycle State Machine

**States**:
- `draft` → Created, not yet started
- `active` → In progress
- `paused` → Temporarily paused
- `achieved` → Successfully completed
- `abandoned` → Given up on
- `archived` → Old/irrelevant

**Transition Diagram**

```
       ┌────────┐
       │ draft  │
       └──┬─────┘
          │ (learner starts working)
          ↓
       ┌────────┐
       │ active │◄──────────────────┐
       └──┬─────┘                   │ (resume)
          │                         │
     (pause)│              ┌────────┴─┐
          │               │  paused  │
          ↓               └──────────┘
       ┌────────┐
       │achieved│ (terminal, may auto-archive after 90 days)
       └────────┘

       (any state)
          │ (deadline passed or user request)
          ↓
       ┌────────┐
       │abandoned│ (terminal)
       └────────┘
```

**Guard Conditions**
- Cannot transition `achieved` → `active`
- Cannot move to `achieved` unless progress = 100%
- Cannot pause if already achieved

**Actions on Entry**
```typescript
onStateEnter(fromState, toState, goal) {
  switch (toState) {
    case 'active':
      // Generate learning path if not exists
      if (!goal.learningPath) {
        recommendationEngine.generatePath(goal);
      }
      // Start deadline timer
      break;
      
    case 'achieved':
      // Award achievement
      achievementService.unlock(goal.learnerId, 'GoalAchievementBadge');
      // Award credits
      creditsService.award(goal.learnerId, 100);
      // Emit GoalAchieved event
      // Suggest related goals
      break;
      
    case 'abandoned':
      // Save abandonment reason for analytics
      // Suggest goal restart mechanism
      // Emit GoalAbandoned event
      break;
  }
}
```

---

## 3. Mission Progress State Machine

**States**:
- `not-started` → Initial state
- `unlocked` → Available but not started
- `in-progress` → Actively working
- `completed` → All requirements met
- `abandoned` → Given up on

**Transition Diagram**

```
       ┌────────────┐
       │ not-started│
       └──┬─────────┘
          │ (prerequisites met)
          ↓
       ┌────────────┐
       │  unlocked  │
       └──┬─────────┘
          │ (learner starts)
          ↓
       ┌────────────┐
       │in-progress │
       └──┬─────────┘
          │ (all assessments pass)
          ↓
       ┌────────────┐
       │ completed  │ (terminal)
       └────────────┘

       (from in-progress, user request)
          │
          ↓
       ┌────────────┐
       │abandoned   │ (terminal)
       └────────────┘
```

**Guard Conditions**
- Cannot transition `unlocked` → `in-progress` if prerequisites not met
- Cannot complete without passing all assessments
- Can only abandon from `in-progress` or `unlocked`

**Actions on Entry**
```typescript
onStateEnter(fromState, toState, progress) {
  switch (toState) {
    case 'unlocked':
      // Emit MissionUnlocked event
      // Notify learner
      notificationService.send(progress.learnerId, {
        type: 'mission-unlocked',
        missionId: progress.missionId
      });
      break;
      
    case 'in-progress':
      // Start timer
      startTimeTracking(progress.learnerId, progress.missionId);
      // Emit MissionStarted event
      break;
      
    case 'completed':
      // Stop timer
      stopTimeTracking(progress.learnerId, progress.missionId);
      // Update competencies
      knowledgeService.updateCompetencies(progress.learnerId, mission.teachesSkills);
      // Emit MissionCompleted event
      // Unlock next missions
      learningPathService.unlockNextMissions(progress.learnerId, progress.missionId);
      break;
      
    case 'abandoned':
      // Stop timer
      stopTimeTracking(progress.learnerId, progress.missionId);
      // Save abandonment reason
      // Suggest restart mechanism
      // Emit MissionAbandoned event
      break;
  }
}
```

---

## 4. Assessment Attempt State Machine

**States**:
- `not-attempted` → Not started
- `in-progress` → Answering questions
- `submitted` → Answers submitted, awaiting score
- `graded` → Score determined
- `passed` → Score exceeds passing threshold
- `failed` → Score below passing threshold

**Transition Diagram**

```
       ┌────────────┐
       │not-attempted│
       └──┬─────────┘
          │
          ↓
       ┌────────────┐
       │in-progress │
       └──┬─────────┘
          │ (submit answers)
          ↓
       ┌────────────┐
       │  submitted │
       └──┬─────────┘
          │ (grade assessment)
          ↓
       ┌────────────┐
       │  graded    │
       └──┬──────┬──────────┐
          │      │          │
       (score >= pass_score)│
          │      │          │
          ↓      ↓          ↓
       ┌──────┐ ┌──────────────┐
       │passed│ │    failed    │
       └──────┘ └──────────────┘
         (terminal behaviors differ based on result)
```

**Guard Conditions**
- Cannot submit empty answers
- Cannot retry without cooldown period (5 minutes)
- Cannot progress past failed assessment without review

**Actions on Entry**
```typescript
onStateEnter(fromState, toState, attempt) {
  switch (toState) {
    case 'in-progress':
      // Start answer timer
      startAnswerTimer(attempt.id);
      // Emit AssessmentAttempted event (when submitted)
      break;
      
    case 'submitted':
      // Queue for grading (sync or async depending on type)
      gradingService.grade(attempt);
      break;
      
    case 'passed':
      // Emit AssessmentPassed event
      // Update competency
      knowledgeService.updateCompetency(
        attempt.learnerId,
        assessment.teachesSkills[0],
        newLevel
      );
      // Award points
      creditsService.award(attempt.learnerId, 10);
      // Check mission completion
      if (isLastAssessmentInMission(attempt)) {
        progressService.completeMission(attempt.learnerId, attempt.missionId);
      }
      break;
      
    case 'failed':
      // Emit AssessmentFailed event
      // Recommend review materials
      recommendationService.suggestReview(attempt.learnerId, attempt.assessmentId);
      // Allow retry after cooldown
      scheduleRetryOption(attempt.id, COOLDOWN_MINUTES);
      break;
  }
}
```

---

## 5. Learning Path State Machine

**States**:
- `active` → Currently being followed
- `paused` → Temporarily halted
- `reordering` → In process of resequencing
- `completed` → All missions finished
- `abandoned` → No longer following

**Transition Diagram**

```
       ┌────────────┐
       │   active   │◄──────┐
       └──┬──────┬──────────┤ (resume)
          │      │          │
     (pause)│    (complete)  └──────────┘
          │      │                    (paused)
          ↓      ↓
       ┌────────────────┐    ┌──────────┐
       │ reordering     │    │ completed│
       └──┬─────────────┘    └──────────┘
          │ (reorder complete)
          ↓
       ┌────────────┐
       │   active   │
       └────────────┘
```

**Guard Conditions**
- Cannot reorder unless active or paused
- Cannot complete unless all missions completed
- Cannot abandon if already completed

**Actions on Entry**
```typescript
onStateEnter(fromState, toState, path) {
  switch (toState) {
    case 'active':
      // Unlock next available mission
      const nextMission = findNextMission(path);
      if (nextMission) {
        progressService.unlockMission(path.learnerId, nextMission.id);
      }
      break;
      
    case 'reordering':
      // Call recommendation engine
      const newOrdering = await recommendationEngine.reorderPath(path);
      // If significantly different, emit event
      if (isDifferent(newOrdering, path)) {
        emit(LearningPathReorderedEvent);
      }
      break;
      
    case 'completed':
      // Emit LearningPathCompleted event
      // Award completion achievement
      achievementService.unlock(path.learnerId, 'PathCompletionBadge');
      // Award credits
      creditsService.award(path.learnerId, 500);
      // Check if goal is achieved
      goalService.checkGoalCompletion(path.learnerId, path.goalId);
      // Suggest next path
      break;
  }
}
```

---

## 6. Knowledge State Evolution

**States**:
- `unknown` → No data yet
- `inferring` → Estimating based on related skills
- `assessed` → Based on quiz/project
- `validated` → Confirmed by multiple assessments
- `mastered` → Expert level

**Transition Diagram**

```
       ┌─────────────┐
       │   unknown   │
       └──┬─────────┘
          │
     (inference or assessment)
          │
          ├─────────────┐
          ↓             ↓
       ┌─────────┐  ┌──────────┐
       │inferring│  │ assessed │
       └─────────┘  └──┬───────┘
                       │ (2+ confirmatory assessments)
                       ↓
                    ┌──────────┐
                    │validated │
                    └──┬───────┘
                       │ (mastery = 90+)
                       ↓
                    ┌──────────┐
                    │ mastered │ (terminal)
                    └──────────┘

       (any state + knowledge update)
          ↓
       (new assessment) → re-evaluate state
```

**Guard Conditions**
- Confidence must be >50% to move from `inferring` → `assessed`
- Must have 2+ independent assessments to validate
- Must score 90+ on assessments to master

**Actions on Entry**
```typescript
onStateEnter(fromState, toState, competency) {
  switch (toState) {
    case 'validated':
      // Emit CompetencyUpdated event if level changed significantly
      // Check for advancement opportunities
      if (competency.level >= 70) {
        recommendationService.suggestAdvancedTopics(
          competency.learnerId,
          competency.skillId
        );
      }
      break;
      
    case 'mastered':
      // Award skill mastery achievement
      achievementService.unlock(competency.learnerId, 'SkillMasteryBadge');
      // Suggest teaching/mentoring opportunities
      recommendationService.suggestMentorRoles(
        competency.learnerId,
        competency.skillId
      );
      break;
  }
}
```

---

## State Transition Rules

### Universal Rules

1. **No Backward Transitions**: States should generally only move forward
   - Exception: Can pause/resume work-in-progress states
   
2. **Idempotent Entry Actions**: If called twice, second call has no additional effect
   - Prevents double-notification, double-awarding

3. **Atomic Transitions**: Entire state change and actions complete before external visibility

4. **Event Emission**: Every state transition should emit an event

### Validation Rules

```typescript
interface StateTransitionValidator {
  // Guards
  canTransition(
    entity: Entity,
    fromState: State,
    toState: State
  ): Promise<ValidationResult>;
  
  // Reasons why transition failed
  getBlockingReasons(
    entity: Entity,
    toState: State
  ): Promise<BlockingReason[]>;
  
  // Pre-transition checks
  validate(
    entity: Entity,
    toState: State
  ): Promise<void>;
}
```

---

## Implementation Considerations

### 1. Concurrency

State transitions must be atomic:

```typescript
async function transitionState(
  entity: Entity,
  newState: State
): Promise<void> {
  // Lock entity to prevent race conditions
  const lock = await lockService.acquire(entity.id);
  try {
    // Validate transition
    await validator.validate(entity, newState);
    
    // Perform transition atomically
    const oldState = entity.state;
    entity.state = newState;
    
    // Save to database in single transaction
    await db.transaction(async (tx) => {
      await tx.update(entity);
      await eventBus.emit(
        StateTransitionEvent({
          entityId: entity.id,
          fromState: oldState,
          toState: newState
        })
      );
    });
    
    // Execute side effects
    await onStateEnter(oldState, newState, entity);
  } finally {
    await lockService.release(lock);
  }
}
```

### 2. Rollback

If entry actions fail, should we rollback the state?

```typescript
// Option A: Optimistic (state set, actions may fail)
// Simpler, but requires idempotent actions

// Option B: Pessimistic (actions must succeed before state change)
// Safer, but may have long-running operations
```

Recommendation: **Optimistic** with idempotent actions and event-driven compensation.

### 3. Timeout Transitions

Some transitions should happen automatically after time:

```typescript
// After 30 days of inactivity, auto-transition
onInactivityTimeout(learnerId: UUID) {
  learner.state = 'inactive';
  emit(LearnerStateTransitionEvent);
}

// After 5 minutes of pause in assessment, allow resume
onAssessmentPauseTimeout(attemptId: UUID) {
  // Warn user, may need to restart
}
```

---

## Testing State Machines

Each state machine should have comprehensive tests:

```typescript
describe('GoalStateM chine', () => {
  it('should transition draft → active', async () => {
    const goal = Goal.createDraft(...);
    await goal.transitionToActive();
    expect(goal.state).toBe('active');
    expect(goal.learningPath).toBeDefined();
  });
  
  it('should NOT transition active → achieved without 100% progress', async () => {
    const goal = Goal.createActive(...);
    goal.progress = 50;
    
    await expect(goal.transitionToAchieved()).rejects.toThrow();
  });
  
  it('should emit event on transition', async () => {
    const goal = Goal.createDraft(...);
    const eventSpy = jest.spyOn(eventBus, 'emit');
    
    await goal.transitionToActive();
    
    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'GoalStateChanged',
        fromState: 'draft',
        toState: 'active'
      })
    );
  });
  
  it('should execute side effects on transition', async () => {
    const goal = Goal.createDraft(...);
    const pathSpy = jest.spyOn(learningPathService, 'generatePath');
    
    await goal.transitionToActive();
    
    expect(pathSpy).toHaveBeenCalledWith(goal.learnerId, goal.id);
  });
});
```

---

**Next Document**: DATABASE_EVOLUTION.md  
**Status**: Ready for review
