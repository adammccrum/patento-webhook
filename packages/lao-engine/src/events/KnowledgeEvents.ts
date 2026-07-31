/**
 * Knowledge State Events
 *
 * These events drive the cognitive layer of LAO.
 * Every event represents evidence that impacts what the learner knows.
 */

/**
 * SkillAssessed - Learner demonstrated knowledge through assessment.
 * This is evidence of mastery (or lack thereof).
 */
export interface SkillAssessedEvent {
  eventType: 'SkillAssessed';
  skillId: string;
  learnerId: string;
  assessmentId: string;
  score: number; // 0-100
  maxScore: number;
  passedThreshold: number; // Score needed to pass
  timeSpentSeconds: number;
  attemptNumber: number;
  metadata?: {
    questionsCorrect?: number;
    questionsTotal?: number;
    difficulty?: string;
  };
}

/**
 * MissionCompletedWithSkills - Mission completion demonstrates skill mastery.
 */
export interface MissionCompletedWithSkillsEvent {
  eventType: 'MissionCompletedWithSkills';
  missionId: string;
  learnerId: string;
  skillsAcquired: Array<{
    skillId: string;
    masteryBoost: number; // 0-100
    confidence: number; // 0-1
  }>;
  qualityScore: number; // 0-100, how well the learner completed it
}

/**
 * MisconceptionDiscovered - A misconception was found during learning.
 */
export interface MisconceptionDiscoveredEvent {
  eventType: 'MisconceptionDiscovered';
  skillId: string;
  learnerId: string;
  misconceptionDescription: string;
  discoveredViaAssessmentId?: string;
  impactedSkills: string[];
  severity: 'minor' | 'moderate' | 'critical'; // How much it blocks learning
}

/**
 * MisconceptionCorrected - A misconception was addressed.
 */
export interface MisconceptionCorrectedEvent {
  eventType: 'MisconceptionCorrected';
  misconceptionId: string;
  skillId: string;
  learnerId: string;
  correctionMethod: 'ai_explanation' | 'reflection' | 'practice' | 'feedback';
  evidence: Array<{
    type: string;
    score: number;
  }>;
}

/**
 * MasteryIncreased - Learner's mastery of a skill increased.
 */
export interface MasteryIncreasedEvent {
  eventType: 'MasteryIncreased';
  skillId: string;
  learnerId: string;
  previousLevel: number; // 0-100
  newLevel: number; // 0-100
  evidenceCount: number;
  stage: 'unfamiliar' | 'aware' | 'developing' | 'proficient' | 'expert';
}

/**
 * MasteryDecayed - Learner's mastery decreased due to lack of practice.
 */
export interface MasteryDecayedEvent {
  eventType: 'MasteryDecayed';
  skillId: string;
  learnerId: string;
  previousLevel: number;
  newLevel: number;
  daysSincePractice: number;
  reinforcementRequired: boolean;
}

/**
 * PrerequisiteMet - Learner now meets prerequisite for a skill.
 */
export interface PrerequisiteMetEvent {
  eventType: 'PrerequisiteMet';
  skillId: string;
  learnerId: string;
  prerequisiteSkillId: string;
  requiredMastery: number;
  achievedMastery: number;
  unlockedSkillsCount: number;
}

/**
 * ReinforcementNeeded - Skill needs practice to maintain mastery.
 */
export interface ReinforcementNeededEvent {
  eventType: 'ReinforcementNeeded';
  skillId: string;
  learnerId: string;
  daysSinceLast: number;
  currentMastery: number;
  suggestedPracticeType: 'practice' | 'reflection' | 'project' | 'assessment';
}

/**
 * QuestionAnswered - Learner answered a question (evidence).
 */
export interface QuestionAnsweredEvent {
  eventType: 'QuestionAnswered';
  skillId: string;
  learnerId: string;
  questionId: string;
  correct: boolean;
  hintUsed: boolean;
  timeSpentSeconds: number;
  confidence: number; // 0-1, how confident they were
}

/**
 * PracticalTaskVerified - Learner completed a real-world task demonstrating skill.
 */
export interface PracticalTaskVerifiedEvent {
  eventType: 'PracticalTaskVerified';
  skillId: string;
  learnerId: string;
  taskId: string;
  score: number; // 0-100
  verifiedBy: 'self' | 'peer' | 'mentor' | 'system';
  evidence: string; // Link to proof
}

/**
 * ReflectionCompleted - Learner reflected on their learning (evidence).
 */
export interface ReflectionCompletedEvent {
  eventType: 'ReflectionCompleted';
  skillId: string;
  learnerId: string;
  reflectionQuality: number; // 0-100
  discoveredMisconceptions: string[];
  learningInsights: string[];
}

/**
 * AIExplanationRequested - Learner asked for AI explanation (signals confidence gap).
 */
export interface AIExplanationRequestedEvent {
  eventType: 'AIExplanationRequested';
  skillId: string;
  learnerId: string;
  topic: string;
  context: 'assessment_struggle' | 'conceptual_confusion' | 'practical_application' | 'review';
  priorAttempts: number;
}

/**
 * SkillKnowledgeGraphUpdated - Knowledge graph relationship updated.
 */
export interface SkillKnowledgeGraphUpdatedEvent {
  eventType: 'SkillKnowledgeGraphUpdated';
  skillId: string;
  learnerId: string;
  relationships: Array<{
    type: 'depends_on' | 'teaches' | 'strengthens' | 'requires' | 'related_to' | 'demonstrates' | 'reinforces';
    targetSkillId: string;
    weight: number; // 0-1, strength of relationship
  }>;
}

/**
 * LearnerMemoryUpdated - Learner memory was updated based on interactions.
 */
export interface LearnerMemoryUpdatedEvent {
  eventType: 'LearnerMemoryUpdated';
  learnerId: string;
  preferredExplanationStyle?: 'visual' | 'textual' | 'practical' | 'conversational';
  preferredPace?: 'slow' | 'normal' | 'fast';
  identifiedStrenghts?: string[];
  identifiedWeaknesses?: string[];
  avoidedSubjects?: string[];
  enjoyedSubjects?: string[];
  successfulStrategies?: string[];
}

/**
 * Union type for all knowledge events.
 */
export type KnowledgeEvent =
  | SkillAssessedEvent
  | MissionCompletedWithSkillsEvent
  | MisconceptionDiscoveredEvent
  | MisconceptionCorrectedEvent
  | MasteryIncreasedEvent
  | MasteryDecayedEvent
  | PrerequisiteMetEvent
  | ReinforcementNeededEvent
  | QuestionAnsweredEvent
  | PracticalTaskVerifiedEvent
  | ReflectionCompletedEvent
  | AIExplanationRequestedEvent
  | SkillKnowledgeGraphUpdatedEvent
  | LearnerMemoryUpdatedEvent;
