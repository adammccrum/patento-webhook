/**
 * Goal Commands - intentions to create and modify goals.
 * Every command produces one or more events.
 * Goals are immutable after events are applied.
 */

export interface CreateGoalCommand {
  learnerId: string;
  title: string;
  description: string;
  goalType: 'skill' | 'certification' | 'career' | 'personal' | 'academic';
  category: string;
  targetValue: number;
  targetUnit: string;
  deadline?: string;
  priority?: number;
  tenantId: string;
  timestamp?: string;
}

export interface ActivateGoalCommand {
  goalId: string;
  learnerId: string;
  tenantId: string;
  timestamp?: string;
}

export interface PauseGoalCommand {
  goalId: string;
  learnerId: string;
  reason?: string;
  tenantId: string;
  timestamp?: string;
}

export interface ResumeGoalCommand {
  goalId: string;
  learnerId: string;
  tenantId: string;
  timestamp?: string;
}

export interface UpdateGoalProgressCommand {
  goalId: string;
  learnerId: string;
  progressPercentage: number;
  tenantId: string;
  timestamp?: string;
}

export interface CompleteGoalCommand {
  goalId: string;
  learnerId: string;
  tenantId: string;
  timestamp?: string;
}

export interface AbandonGoalCommand {
  goalId: string;
  learnerId: string;
  reason?: string;
  tenantId: string;
  timestamp?: string;
}
