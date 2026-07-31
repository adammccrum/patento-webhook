import { v4 as uuidv4 } from 'uuid';

export type GoalType = 'skill' | 'certification' | 'career' | 'personal' | 'academic';
export type GoalStatus = 'draft' | 'active' | 'paused' | 'achieved' | 'abandoned' | 'archived';

/**
 * Goal represents what a learner wants to achieve.
 * Immutable: all changes produce new instances.
 */
export class Goal {
  readonly id: string;
  readonly learnerId: string;
  readonly title: string;
  readonly description: string;
  readonly goalType: GoalType;
  readonly category: string;

  // SMART goal attributes
  readonly targetValue: number;
  readonly targetUnit: string;
  readonly deadline?: string; // ISO 8601

  // Status
  readonly status: GoalStatus;
  readonly progressPercentage: number; // 0-100

  // Metadata
  readonly priority: number; // 1-5
  readonly createdAt: string; // ISO 8601
  readonly updatedAt: string; // ISO 8601
  readonly achievedAt?: string; // ISO 8601
  readonly tenantId: string;

  constructor(data: {
    id: string;
    learnerId: string;
    title: string;
    description: string;
    goalType: GoalType;
    category: string;
    targetValue: number;
    targetUnit: string;
    deadline?: string;
    status: GoalStatus;
    progressPercentage: number;
    priority: number;
    createdAt: string;
    updatedAt: string;
    achievedAt?: string;
    tenantId: string;
  }) {
    this.id = data.id;
    this.learnerId = data.learnerId;
    this.title = data.title;
    this.description = data.description;
    this.goalType = data.goalType;
    this.category = data.category;
    this.targetValue = data.targetValue;
    this.targetUnit = data.targetUnit;
    this.deadline = data.deadline;
    this.status = data.status;
    this.progressPercentage = data.progressPercentage;
    this.priority = data.priority;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.achievedAt = data.achievedAt;
    this.tenantId = data.tenantId;
  }

  /**
   * Create a new Goal instance (factory method).
   */
  static create(data: {
    learnerId: string;
    title: string;
    description: string;
    goalType: GoalType;
    category: string;
    targetValue: number;
    targetUnit: string;
    deadline?: string;
    priority?: number;
    tenantId: string;
  }): Goal {
    const now = new Date().toISOString();
    return new Goal({
      id: uuidv4(),
      learnerId: data.learnerId,
      title: data.title,
      description: data.description,
      goalType: data.goalType,
      category: data.category,
      targetValue: data.targetValue,
      targetUnit: data.targetUnit,
      deadline: data.deadline,
      status: 'draft',
      progressPercentage: 0,
      priority: data.priority || 3,
      createdAt: now,
      updatedAt: now,
      tenantId: data.tenantId,
    });
  }

  /**
   * Return new instance with updated progress.
   */
  withProgress(progressPercentage: number): Goal {
    return new Goal({
      ...this,
      progressPercentage: Math.max(0, Math.min(100, progressPercentage)),
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Return new instance with new status.
   */
  withStatus(status: GoalStatus, achievedAt?: string): Goal {
    return new Goal({
      ...this,
      status,
      achievedAt: achievedAt || this.achievedAt,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Return new instance with updated priority.
   */
  withPriority(priority: number): Goal {
    return new Goal({
      ...this,
      priority: Math.max(1, Math.min(5, priority)),
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Check if goal can transition to a new status (state machine validation).
   */
  canTransitionTo(newStatus: GoalStatus): boolean {
    const validTransitions: Record<GoalStatus, GoalStatus[]> = {
      draft: ['active', 'abandoned'],
      active: ['paused', 'achieved', 'abandoned'],
      paused: ['active', 'abandoned'],
      achieved: ['archived'],
      abandoned: ['archived'],
      archived: [],
    };

    return validTransitions[this.status]?.includes(newStatus) || false;
  }

  /**
   * Validate goal state for invariants.
   */
  validate(): void {
    if (!this.id) throw new Error('Goal id is required');
    if (!this.learnerId) throw new Error('LearnerId is required');
    if (!this.title || this.title.trim().length === 0) throw new Error('Title is required');
    if (this.targetValue <= 0) throw new Error('TargetValue must be positive');
    if (this.progressPercentage < 0 || this.progressPercentage > 100) {
      throw new Error('ProgressPercentage must be 0-100');
    }
    if (this.priority < 1 || this.priority > 5) {
      throw new Error('Priority must be 1-5');
    }
    // Cannot achieve without 100% progress
    if (this.status === 'achieved' && this.progressPercentage !== 100) {
      throw new Error('Cannot achieve goal with less than 100% progress');
    }
  }

  /**
   * Serialize to JSON for storage.
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      learnerId: this.learnerId,
      title: this.title,
      description: this.description,
      goalType: this.goalType,
      category: this.category,
      targetValue: this.targetValue,
      targetUnit: this.targetUnit,
      deadline: this.deadline,
      status: this.status,
      progressPercentage: this.progressPercentage,
      priority: this.priority,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      achievedAt: this.achievedAt,
      tenantId: this.tenantId,
    };
  }
}
