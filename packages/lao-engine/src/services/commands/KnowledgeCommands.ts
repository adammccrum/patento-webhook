/**
 * Knowledge State Commands
 *
 * Commands represent intentions to record evidence of learning.
 * Each command produces one or more events that update KnowledgeState.
 */

/**
 * RecordAssessment - Record that learner took an assessment.
 */
export interface RecordAssessmentCommand {
  learnerId: string;
  skillId: string;
  assessmentId: string;
  score: number; // 0-100
  maxScore: number;
  passThreshold: number;
  timeSpentSeconds: number;
  attemptNumber: number;
  tenantId: string;
  metadata?: Record<string, unknown>;
}

/**
 * RecordMissionCompletion - Record skill improvements from mission completion.
 */
export interface RecordMissionCompletionCommand {
  learnerId: string;
  missionId: string;
  skillsAcquired: Array<{
    skillId: string;
    masteryBoost: number; // 0-100
    confidence: number; // 0-1
  }>;
  qualityScore: number; // 0-100
  tenantId: string;
}

/**
 * DiscoverMisconception - Record a misconception discovered.
 */
export interface DiscoverMisconceptionCommand {
  learnerId: string;
  skillId: string;
  misconceptionDescription: string;
  discoveredViaAssessmentId?: string;
  impactedSkills: string[];
  severity: 'minor' | 'moderate' | 'critical';
  tenantId: string;
}

/**
 * CorrectMisconception - Record that a misconception was addressed.
 */
export interface CorrectMisconceptionCommand {
  learnerId: string;
  misconceptionId: string;
  skillId: string;
  correctionMethod: 'ai_explanation' | 'reflection' | 'practice' | 'feedback';
  evidence: Array<{
    type: string;
    score: number;
  }>;
  tenantId: string;
}

/**
 * RecordQuestion - Record learner answered a question.
 */
export interface RecordQuestionCommand {
  learnerId: string;
  skillId: string;
  questionId: string;
  correct: boolean;
  hintUsed: boolean;
  timeSpentSeconds: number;
  confidence: number; // 0-1
  tenantId: string;
}

/**
 * RecordPracticalTask - Record learner completed a practical task.
 */
export interface RecordPracticalTaskCommand {
  learnerId: string;
  skillId: string;
  taskId: string;
  score: number; // 0-100
  verifiedBy: 'self' | 'peer' | 'mentor' | 'system';
  evidence: string; // Link to proof
  tenantId: string;
}

/**
 * RecordReflection - Record learner completed reflection.
 */
export interface RecordReflectionCommand {
  learnerId: string;
  skillId: string;
  reflectionQuality: number; // 0-100
  discoveredMisconceptions: string[];
  learningInsights: string[];
  tenantId: string;
}

/**
 * RequestAIExplanation - Record request for AI explanation.
 */
export interface RequestAIExplanationCommand {
  learnerId: string;
  skillId: string;
  topic: string;
  context: 'assessment_struggle' | 'conceptual_confusion' | 'practical_application' | 'review';
  priorAttempts: number;
  tenantId: string;
}

/**
 * UpdateKnowledgeGraph - Update graph relationships for a skill.
 */
export interface UpdateKnowledgeGraphCommand {
  learnerId: string;
  skillId: string;
  relationships: Array<{
    type: 'depends_on' | 'teaches' | 'strengthens' | 'requires' | 'related_to' | 'demonstrates' | 'reinforces';
    targetSkillId: string;
    weight: number; // 0-1
  }>;
  tenantId: string;
}

/**
 * UpdateLearnerMemory - Update learner memory based on patterns.
 */
export interface UpdateLearnerMemoryCommand {
  learnerId: string;
  preferredExplanationStyle?: 'visual' | 'textual' | 'practical' | 'conversational';
  preferredPace?: 'slow' | 'normal' | 'fast';
  identifiedStrengths?: string[];
  identifiedWeaknesses?: string[];
  avoidedSubjects?: string[];
  enjoyedSubjects?: string[];
  successfulStrategies?: string[];
  tenantId: string;
}

/**
 * SetPrerequisites - Define prerequisites for a skill.
 */
export interface SetPrerequisitesCommand {
  learnerId: string;
  skillId: string;
  prerequisites: Array<{
    skillId: string;
    requiredMastery: number; // 0-100
  }>;
  tenantId: string;
}

/**
 * RegisterSkillDependents - Register skills that depend on this skill.
 */
export interface RegisterSkillDependentsCommand {
  learnerId: string;
  skillId: string;
  dependentSkillIds: string[];
  tenantId: string;
}

/**
 * TriggerReinforcement - Explicitly trigger reinforcement recommendation.
 */
export interface TriggerReinforcementCommand {
  learnerId: string;
  skillId: string;
  reason: 'decay_detected' | 'time_elapsed' | 'goal_requires_it' | 'manual_trigger';
  tenantId: string;
}

/**
 * ApplyKnowledgeDecay - Apply time-based knowledge decay.
 */
export interface ApplyKnowledgeDecayCommand {
  learnerId: string;
  skillId: string;
  daysSincePractice: number;
  tenantId: string;
}
