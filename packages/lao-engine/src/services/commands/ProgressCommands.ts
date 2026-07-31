/**
 * Progress Commands - track learner movement through missions.
 * Progress is derived from events: missions started, lessons completed, missions finished.
 * Progress service aggregates these into learning velocity and consistency metrics.
 */

export interface StartMissionCommand {
  learnerId: string;
  missionId: string;
  goalId?: string;
  tenantId: string;
  timestamp?: string;
}

export interface CompleteLessonCommand {
  learnerId: string;
  missionId: string;
  lessonId: string;
  comprehensionScore: number;
  timeSpentMinutes: number;
  tenantId: string;
  timestamp?: string;
}

export interface CompleteMissionCommand {
  learnerId: string;
  missionId: string;
  finalComprehensionScore: number;
  totalTimeSpentMinutes: number;
  tenantId: string;
  timestamp?: string;
}

export interface AbandonMissionCommand {
  learnerId: string;
  missionId: string;
  reason?: string;
  tenantId: string;
  timestamp?: string;
}

export interface RecordMissionSkillCommand {
  learnerId: string;
  missionId: string;
  skillId: string;
  proficiencyLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  tenantId: string;
  timestamp?: string;
}
