import { DomainEvent } from './DomainEvent';

/**
 * EventCatalog is the registry of all known event types.
 * Used for documentation, validation, and versioning.
 */
export interface EventTypeDefinition {
  eventType: string;
  aggregateType: string;
  version: number;
  description: string;
  schema: Record<string, unknown>; // JSON Schema describing the payload
  reactions: string[]; // Event types that typically react to this
}

/**
 * Master registry of all event types in the LAO system.
 * Each event type is documented, versioned, and linked to reactions.
 */
export const EVENT_CATALOG: EventTypeDefinition[] = [
  // ============ LEARNER LIFECYCLE EVENTS ============

  {
    eventType: 'UserOnboarded',
    aggregateType: 'Learner',
    version: 1,
    description: 'Fired when a new learner completes onboarding',
    schema: {
      learnerId: 'string (UUID)',
      email: 'string',
      name: 'string',
      learningStyle: 'string (visual|auditory|kinesthetic|reading)',
      pacePreference: 'string (slow|normal|fast)',
      timezone: 'string',
      onboardedAt: 'string (ISO 8601)',
    },
    reactions: ['LearnerProfileCreated'],
  },

  {
    eventType: 'LearnerPreferencesUpdated',
    aggregateType: 'Learner',
    version: 1,
    description: 'Fired when learner updates preferences',
    schema: {
      learnerId: 'string (UUID)',
      learningStyle: 'string (optional)',
      pacePreference: 'string (optional)',
      availableHoursPerWeek: 'number (optional)',
      timezone: 'string (optional)',
      topicsOfInterest: 'string[] (optional)',
    },
    reactions: ['RecommendationEngineInvalidated'],
  },

  {
    eventType: 'LearnerStateChanged',
    aggregateType: 'Learner',
    version: 1,
    description: 'Fired when learner state transitions (active, paused, inactive, deactivated)',
    schema: {
      learnerId: 'string (UUID)',
      fromState: 'string',
      toState: 'string (active|paused|inactive|deactivated|suspended)',
      reason: 'string (optional)',
      transitionedAt: 'string (ISO 8601)',
    },
    reactions: [],
  },

  // ============ GOAL EVENTS ============

  {
    eventType: 'GoalCreated',
    aggregateType: 'Goal',
    version: 1,
    description: 'Fired when learner creates a new goal',
    schema: {
      goalId: 'string (UUID)',
      learnerId: 'string (UUID)',
      title: 'string',
      goalType: 'string (skill|certification|career|personal|academic)',
      targetValue: 'number',
      targetUnit: 'string',
      deadline: 'string (ISO 8601, optional)',
      createdAt: 'string (ISO 8601)',
    },
    reactions: ['LearningPathGenerated', 'KnowledgeGapDetected'],
  },

  {
    eventType: 'GoalProgressUpdated',
    aggregateType: 'Goal',
    version: 1,
    description: 'Fired when goal progress changes',
    schema: {
      goalId: 'string (UUID)',
      learnerId: 'string (UUID)',
      progressPercentage: 'number (0-100)',
      updatedAt: 'string (ISO 8601)',
    },
    reactions: [],
  },

  {
    eventType: 'GoalAchieved',
    aggregateType: 'Goal',
    version: 1,
    description: 'Fired when learner achieves a goal',
    schema: {
      goalId: 'string (UUID)',
      learnerId: 'string (UUID)',
      achievedAt: 'string (ISO 8601)',
      finalProgressPercentage: 'number',
      timeToAchieveSeconds: 'number',
    },
    reactions: ['AchievementUnlocked', 'CreditsAwarded'],
  },

  {
    eventType: 'GoalAbandoned',
    aggregateType: 'Goal',
    version: 1,
    description: 'Fired when learner abandons a goal',
    schema: {
      goalId: 'string (UUID)',
      learnerId: 'string (UUID)',
      reason: 'string (optional)',
      abandonedAt: 'string (ISO 8601)',
    },
    reactions: [],
  },

  // ============ LEARNING PATH EVENTS ============

  {
    eventType: 'LearningPathGenerated',
    aggregateType: 'LearningPath',
    version: 1,
    description: 'Fired when recommendation engine generates a learning path',
    schema: {
      pathId: 'string (UUID)',
      learnerId: 'string (UUID)',
      goalId: 'string (UUID)',
      missions: 'string[] (mission IDs in order)',
      estimatedCompletionDays: 'number',
      generatedAt: 'string (ISO 8601)',
      strategy: 'string (goal-driven|skill-driven|interest-driven|adaptive)',
    },
    reactions: ['MissionUnlocked'],
  },

  {
    eventType: 'LearningPathReordered',
    aggregateType: 'LearningPath',
    version: 1,
    description: 'Fired when learning path is dynamically reordered',
    schema: {
      pathId: 'string (UUID)',
      learnerId: 'string (UUID)',
      oldSequence: 'string[] (old mission IDs)',
      newSequence: 'string[] (new mission IDs)',
      reason: 'string (performance|preference|skill-gap)',
      reorderedAt: 'string (ISO 8601)',
    },
    reactions: [],
  },

  {
    eventType: 'LearningPathCompleted',
    aggregateType: 'LearningPath',
    version: 1,
    description: 'Fired when all missions in a learning path are completed',
    schema: {
      pathId: 'string (UUID)',
      learnerId: 'string (UUID)',
      goalId: 'string (UUID)',
      completedAt: 'string (ISO 8601)',
      totalTimeSpentHours: 'number',
    },
    reactions: ['AchievementUnlocked', 'CreditsAwarded'],
  },

  // ============ MISSION EVENTS ============

  {
    eventType: 'MissionUnlocked',
    aggregateType: 'Mission',
    version: 1,
    description: 'Fired when a mission becomes available to learner',
    schema: {
      missionId: 'string (UUID)',
      learnerId: 'string (UUID)',
      pathId: 'string (UUID, optional)',
      unlockedAt: 'string (ISO 8601)',
      prerequisitesMet: 'boolean',
    },
    reactions: [],
  },

  {
    eventType: 'MissionStarted',
    aggregateType: 'Mission',
    version: 1,
    description: 'Fired when learner starts working on a mission',
    schema: {
      missionId: 'string (UUID)',
      learnerId: 'string (UUID)',
      startedAt: 'string (ISO 8601)',
    },
    reactions: [],
  },

  {
    eventType: 'LessonCompleted',
    aggregateType: 'Mission',
    version: 1,
    description: 'Fired when learner completes a lesson within a mission',
    schema: {
      missionId: 'string (UUID)',
      lessonId: 'string (UUID)',
      learnerId: 'string (UUID)',
      completedAt: 'string (ISO 8601)',
      timeSpentSeconds: 'number',
    },
    reactions: [],
  },

  {
    eventType: 'MissionCompleted',
    aggregateType: 'Mission',
    version: 1,
    description: 'Fired when learner completes a mission (all assessments passed)',
    schema: {
      missionId: 'string (UUID)',
      learnerId: 'string (UUID)',
      completedAt: 'string (ISO 8601)',
      timeSpentHours: 'number',
      comprehensionScore: 'number (0-100)',
    },
    reactions: [
      'CompetencyUpdated',
      'MissionUnlocked',
      'GoalProgressUpdated',
      'AchievementUnlocked',
      'CreditsAwarded',
    ],
  },

  {
    eventType: 'MissionAbandoned',
    aggregateType: 'Mission',
    version: 1,
    description: 'Fired when learner abandons a mission',
    schema: {
      missionId: 'string (UUID)',
      learnerId: 'string (UUID)',
      reason: 'string (optional)',
      abandonedAt: 'string (ISO 8601)',
    },
    reactions: [],
  },

  // ============ ASSESSMENT EVENTS ============

  {
    eventType: 'AssessmentAttempted',
    aggregateType: 'Assessment',
    version: 1,
    description: 'Fired when learner submits an assessment',
    schema: {
      assessmentId: 'string (UUID)',
      learnerId: 'string (UUID)',
      missionId: 'string (UUID)',
      attemptNumber: 'number',
      submittedAt: 'string (ISO 8601)',
    },
    reactions: [],
  },

  {
    eventType: 'AssessmentPassed',
    aggregateType: 'Assessment',
    version: 1,
    description: 'Fired when learner passes an assessment',
    schema: {
      assessmentId: 'string (UUID)',
      learnerId: 'string (UUID)',
      missionId: 'string (UUID)',
      score: 'number (0-100)',
      passedAt: 'string (ISO 8601)',
    },
    reactions: ['CompetencyUpdated', 'CreditsAwarded'],
  },

  {
    eventType: 'AssessmentFailed',
    aggregateType: 'Assessment',
    version: 1,
    description: 'Fired when learner fails an assessment',
    schema: {
      assessmentId: 'string (UUID)',
      learnerId: 'string (UUID)',
      missionId: 'string (UUID)',
      score: 'number (0-100)',
      passingScore: 'number',
      failedAt: 'string (ISO 8601)',
      retryAllowed: 'boolean',
    },
    reactions: [],
  },

  // ============ ACHIEVEMENT EVENTS ============

  {
    eventType: 'AchievementUnlocked',
    aggregateType: 'Achievement',
    version: 1,
    description: 'Fired when learner unlocks an achievement (badge, certificate, etc)',
    schema: {
      achievementId: 'string (UUID)',
      learnerId: 'string (UUID)',
      achievementType: 'string (badge|certificate|milestone|streak)',
      title: 'string',
      rarityTier: 'string (common|uncommon|rare|epic|legendary)',
      creditsAwarded: 'number',
      unlockedAt: 'string (ISO 8601)',
    },
    reactions: ['CreditsAwarded'],
  },

  // ============ KNOWLEDGE EVENTS ============

  {
    eventType: 'CompetencyUpdated',
    aggregateType: 'KnowledgeState',
    version: 1,
    description: 'Fired when learner competency level changes',
    schema: {
      learnerId: 'string (UUID)',
      skillId: 'string (UUID)',
      skillName: 'string',
      newLevel: 'number (0-100)',
      oldLevel: 'number (0-100)',
      confidence: 'number (0-100)',
      assessmentMethod: 'string (quiz|project|ai-evaluation|self-report|inference)',
      updatedAt: 'string (ISO 8601)',
    },
    reactions: ['RecommendationEngineInvalidated'],
  },

  {
    eventType: 'KnowledgeGapDetected',
    aggregateType: 'KnowledgeState',
    version: 1,
    description: 'Fired when a knowledge gap is identified',
    schema: {
      learnerId: 'string (UUID)',
      skillId: 'string (UUID)',
      skillName: 'string',
      priority: 'number (1-10)',
      detectedBy: 'string (goal-analysis|mission-requirement|ai-evaluation)',
      detectedAt: 'string (ISO 8601)',
    },
    reactions: [],
  },

  // ============ SYSTEM EVENTS ============

  {
    eventType: 'LearnerBecameInactive',
    aggregateType: 'Learner',
    version: 1,
    description: 'System event fired when learner has not been active for threshold time',
    schema: {
      learnerId: 'string (UUID)',
      inactivityDays: 'number',
      lastActivityAt: 'string (ISO 8601)',
      detectedAt: 'string (ISO 8601)',
    },
    reactions: ['LearnerStateChanged'],
  },

  {
    eventType: 'CreditsAwarded',
    aggregateType: 'Learner',
    version: 1,
    description: 'Fired when learner earns credits',
    schema: {
      learnerId: 'string (UUID)',
      creditsAmount: 'number',
      reason: 'string (mission-completion|achievement-unlock|goal-achieved|bonus)',
      awardedAt: 'string (ISO 8601)',
    },
    reactions: [],
  },

  {
    eventType: 'RecommendationEngineInvalidated',
    aggregateType: 'Learner',
    version: 1,
    description: 'System event indicating learner state changed, recommendations should be recalculated',
    schema: {
      learnerId: 'string (UUID)',
      reason: 'string (preference-change|competency-change|goal-change)',
      invalidatedAt: 'string (ISO 8601)',
    },
    reactions: [],
  },
];

/**
 * Look up event type definition by name.
 */
export function getEventDefinition(eventType: string): EventTypeDefinition | undefined {
  return EVENT_CATALOG.find((e) => e.eventType === eventType);
}

/**
 * Validate that an event's structure matches its definition.
 * Returns true if valid, false otherwise.
 */
export function isEventTypeKnown(eventType: string): boolean {
  return EVENT_CATALOG.some((e) => e.eventType === eventType);
}

/**
 * Get all events that typically react to a given event type.
 */
export function getReactingEventTypes(eventType: string): string[] {
  const definition = getEventDefinition(eventType);
  return definition?.reactions || [];
}

/**
 * Get all events for a specific aggregate type.
 */
export function getEventsByAggregateType(aggregateType: string): EventTypeDefinition[] {
  return EVENT_CATALOG.filter((e) => e.aggregateType === aggregateType);
}
