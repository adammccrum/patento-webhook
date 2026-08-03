/**
 * Event Flow Architecture
 *
 * This document describes how events flow through LAO's core services.
 * Commands produce events. Events change state. Services react to events.
 *
 * === LEARNER AGGREGATE ===
 *
 * Command: RegisterLearner
 *   └─> LearnerRegistered (foundation fact)
 *   └─> UserOnboarded (immediate transition)
 *
 * Command: UpdatePreferences
 *   └─> LearnerPreferencesUpdated
 *       └─> RecommendationEngineInvalidated (triggers path recalculation)
 *
 * Command: UpdateState (active, paused, inactive, deactivated)
 *   └─> LearnerStateChanged
 *
 * Command: RecordLearningSession
 *   └─> LearningSessionRecorded
 *       └─> StreakUpdated (if applies)
 *
 * === GOAL AGGREGATE ===
 *
 * Command: CreateGoal
 *   └─> GoalCreated
 *       └─> LearningPathGenerated (recommends missions)
 *       └─> KnowledgeGapDetected (analyzes skills)
 *
 * Command: ActivateGoal
 *   └─> GoalActivated
 *       └─> LearningPathGenerated (if new recommendations needed)
 *
 * Command: UpdateGoalProgress
 *   └─> GoalProgressUpdated
 *       └─> RecommendationEngineInvalidated
 *       └─> GoalMilestoneReached (if 25%, 50%, 75%, 100%)
 *
 * Command: CompleteGoal
 *   └─> GoalCompleted (only at 100% progress)
 *       └─> AchievementUnlocked (achievement evaluators react)
 *       └─> CreditsAwarded
 *       └─> GoalAchievementCelebration
 *
 * Command: AbandonGoal
 *   └─> GoalAbandoned
 *       └─> LearnerBecameInactive (if last active goal was abandoned)
 *
 * === MISSION AGGREGATE ===
 *
 * Command: StartMission
 *   └─> MissionStarted
 *       └─> GoalProgressUpdated (if mission linked to goal)
 *
 * Command: CompleteMission
 *   └─> LessonCompleted (per lesson)
 *       └─> ComprehensionScoreRecorded
 *       └─> CompetencyUpdated (skill advancement)
 *   └─> MissionCompleted (final)
 *       └─> GoalProgressUpdated
 *       └─> AchievementUnlocked
 *       └─> CreditsAwarded
 *       └─> SkillAcquired (if all prerequisites met)
 *       └─> RecommendationEngineInvalidated
 *
 * Command: AbandonMission
 *   └─> MissionAbandoned
 *
 * === SKILL & COMPETENCY UPDATES ===
 *
 * Reaction: CompetencyUpdated
 *   └─> KnowledgeProfileUpdated (learner's skill map)
 *   └─> SkillMastered (when proficiency reaches expert)
 *   └─> RelatedSkillsUnlocked (prerequisite for new missions)
 *
 * === ACHIEVEMENT & GAMIFICATION ===
 *
 * Reaction: AchievementUnlocked
 *   └─> CreditsAwarded (immediate reward)
 *   └─> LearnerNotified (notification service)
 *
 * Reaction: StreakMilestone
 *   └─> CreditsAwarded (7-day, 30-day, 100-day streaks)
 *
 * === SYSTEM EVENTS ===
 *
 * Reaction: LearnerInactivityDetected (cron job)
 *   └─> LearnerBecameInactive (system event)
 *   └─> PauseActiveGoals (if applicable)
 *
 * === EVENT PUBLISHING SEQUENCE ===
 *
 * 1. Command arrives at service
 * 2. Service validates command
 * 3. Service reconstructs aggregate from event history (if needed)
 * 4. Service applies business rules
 * 5. Service produces event(s)
 * 6. Event is persisted to EventStore (write)
 * 7. Event is published to EventBus (pub/sub)
 * 8. All subscribers receive event (async)
 * 9. Subscribers produce their own events (cascade)
 *
 * === CAUSALITY TRACKING ===
 *
 * Every event has:
 * - eventId: unique identifier
 * - causationId: the event that caused this event
 * - correlationId: traces complete workflow
 * - timestamp: precise timing
 *
 * Example:
 * User submits goal completion → GoalCompleted event
 *   - causationId = GoalCompleted event
 *   - triggers: AchievementUnlocked (causationId = GoalCompleted)
 *   - triggers: CreditsAwarded (causationId = GoalCompleted)
 *   - All linked by same correlationId
 *
 * === READ MODEL UPDATES ===
 *
 * EventBus publishes to:
 * 1. Event Store (persistence)
 * 2. ReadModelProjector (dashboard updates)
 * 3. Service subscribers (cascading commands)
 * 4. External systems (webhooks, analytics)
 *
 * === IDEMPOTENCY GUARANTEE ===
 *
 * All events are idempotent:
 * - Same command → same events
 * - Duplicate event processing → same result
 * - Deduplication via eventId
 *
 * === AT-LEAST-ONCE SEMANTICS ===
 *
 * EventBus guarantees:
 * - All subscribers eventually receive event
 * - Event processing is logged
 * - Failures are retried
 * - Poison pill events (unsub after N failures)
 */

/**
 * Aggregate Lifecycle Documentation
 *
 * === LEARNER LIFECYCLE ===
 *
 * State: onboarding (initial)
 *   └─> [commands: UpdatePreferences, RecordActivity]
 *   └─> active (explicit activation or first mission)
 *
 * State: active (engaged learner)
 *   └─> paused (learner-initiated pause)
 *   └─> inactive (no activity for 30 days)
 *   └─> deactivated (learner-initiated removal)
 *
 * State: paused (learner paused learning)
 *   └─> active (learner resumes)
 *   └─> inactive (no activity while paused)
 *
 * State: inactive (no activity for 30 days)
 *   └─> active (resumption)
 *   └─> deactivated (permanent removal)
 *
 * State: deactivated (deleted or permanently paused)
 *   └─> [no transitions]
 *
 * State: suspended (system suspension, e.g., due to violation)
 *   └─> active (admin unsuspension)
 *   └─> deactivated (permanent ban)
 *
 * === GOAL LIFECYCLE ===
 *
 * State: draft (initial)
 *   └─> active (learner activates goal)
 *   └─> abandoned (learner gives up without pursuit)
 *
 * State: active (learner working towards goal)
 *   └─> paused (learner pauses)
 *   └─> achieved (progress reaches 100%)
 *   └─> abandoned (learner gives up)
 *
 * State: paused (goal on hold)
 *   └─> active (learner resumes)
 *   └─> abandoned (learner gives up)
 *
 * State: achieved (goal completed at 100% progress)
 *   └─> archived (historical archival)
 *   └─> [no other transitions]
 *
 * State: abandoned (goal given up)
 *   └─> archived (historical archival)
 *   └─> [no other transitions]
 *
 * State: archived (historical record)
 *   └─> [no transitions - terminal state]
 *
 * === MISSION PROGRESS LIFECYCLE ===
 *
 * State: not-started (initial)
 *   └─> unlocked (prerequisites met, mission recommended)
 *
 * State: unlocked (available to learner)
 *   └─> in-progress (learner starts mission)
 *   └─> abandoned (learner gives up)
 *
 * State: in-progress (learner actively working)
 *   └─> completed (all lessons passed, assessments met)
 *   └─> abandoned (learner gives up)
 *
 * State: completed (mission finished successfully)
 *   └─> [no transitions - terminal state]
 *   └─> Triggers: CompetencyUpdated, SkillAcquired, AchievementUnlocked
 *
 * State: abandoned (given up mid-way)
 *   └─> [no transitions - terminal state]
 *   └─> Triggers: no rewards
 *
 * === INVARIANTS (business rules) ===
 *
 * Learner:
 * - Email is unique per tenant
 * - Name cannot be empty
 * - Preferences are always defined (even if default)
 *
 * Goal:
 * - Only one goal can be achieved per type per learner (optional constraint)
 * - Cannot transition to achieved without 100% progress
 * - Cannot be abandoned if already achieved
 * - Deadline must be in future
 * - Cannot have multiple active instances of same goal
 *
 * Mission Progress:
 * - lessonsCompleted ≤ lessonsTotal
 * - comprehensionScore is 0-100
 * - Cannot be completed if any assessment failed
 * - Cannot be abandoned after completion
 *
 * === EVENT VERSIONING ===
 *
 * All events have version number for upcasting/downcasting.
 * Example: GoalCreated v1 vs v2 (if schema changes)
 *
 * Migration strategy:
 * - Keep old event consumers
 * - Add new event consumers for v2
 * - Upcast v1 events to v2 during replay if needed
 * - Eventually deprecate old consumers
 *
 * === EXAMPLE: COMPLETE WORKFLOW ===
 *
 * 1. User registers (RegisterLearner)
 *    → LearnerRegistered, UserOnboarded
 *
 * 2. User creates goal (CreateGoal)
 *    → GoalCreated
 *    → LearningPathGenerated, KnowledgeGapDetected
 *
 * 3. User activates goal (ActivateGoal)
 *    → GoalActivated
 *    → LearningPathGenerated (recommendations updated)
 *
 * 4. User starts mission (StartMission)
 *    → MissionStarted
 *    → GoalProgressUpdated (progress increased)
 *
 * 5. User completes lesson (CompleteLessonCommand)
 *    → LessonCompleted
 *    → ComprehensionScoreRecorded
 *    → CompetencyUpdated (skill advancement tracked)
 *
 * 6. User completes all lessons → mission auto-completes
 *    → MissionCompleted
 *    → CompetencyUpdated (final skill advancement)
 *    → GoalProgressUpdated (goal progress += mission contribution)
 *    → AchievementUnlocked (if criteria met)
 *    → CreditsAwarded
 *
 * 7. Goal reaches 100% progress → user marks achieved
 *    → GoalCompleted
 *    → AchievementUnlocked (goal achievement bonus)
 *    → CreditsAwarded (significant bonus)
 *
 * === PERFORMANCE CHARACTERISTICS ===
 *
 * Command latency: 10-50ms (includes event store write)
 * Event publishing: 5-20ms (async, all subscribers notified)
 * Aggregate reconstruction: 1-5ms per 100 events
 * Read model update: 1-10ms per event
 *
 * Baseline benchmarks collected during Phase 2.
 */

// This file is documentation only.
// Actual implementations in LearnerService, GoalService, ProgressService.
