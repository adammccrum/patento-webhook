import { LearnerPreferences } from '../../domain';

/**
 * Commands represent intentions—what a learner or system wants to do.
 * Commands produce events, which are immutable facts.
 * Each command handler is responsible for:
 * 1. Validating the command
 * 2. Reconstructing aggregate from event history
 * 3. Applying business rules
 * 4. Producing events
 * 5. Persisting events
 */

export interface RegisterLearnerCommand {
  email: string;
  name: string;
  preferences: LearnerPreferences;
  tenantId: string;
  timestamp?: string;
}

export interface CompleteOnboardingCommand {
  learnerId: string;
  tenantId: string;
  timestamp?: string;
}

export interface PauseLearningCommand {
  learnerId: string;
  reason?: string;
  tenantId: string;
  timestamp?: string;
}

export interface ResumeLearningCommand {
  learnerId: string;
  reason?: string;
  tenantId: string;
  timestamp?: string;
}

export interface UpdatePreferencesCommand {
  learnerId: string;
  preferences: Partial<LearnerPreferences>;
  tenantId: string;
  timestamp?: string;
}

export interface RecordLearningSessionCommand {
  learnerId: string;
  sessionDurationMinutes: number;
  missionId?: string;
  completedLessonsCount?: number;
  tenantId: string;
  timestamp?: string;
}

export interface DeactivateLearnerCommand {
  learnerId: string;
  reason?: string;
  tenantId: string;
  timestamp?: string;
}
