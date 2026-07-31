import { v4 as uuidv4 } from 'uuid';

export type MissionProgressStatus = 'not-started' | 'unlocked' | 'in-progress' | 'completed' | 'abandoned';

/**
 * Tracks learner progress on a specific mission.
 * Typically created from events, not directly instantiated.
 * Immutable.
 */
export class MissionProgress {
  readonly id: string;
  readonly learnerId: string;
  readonly missionId: string;

  readonly status: MissionProgressStatus;
  readonly lessonsCompleted: number;
  readonly lessonsTotal: number;
  readonly comprehensionScore: number; // 0-100
  readonly timeSpentHours: number;

  readonly startedAt?: string; // ISO 8601
  readonly completedAt?: string; // ISO 8601
  readonly createdAt: string; // ISO 8601
  readonly updatedAt: string; // ISO 8601
  readonly tenantId: string;

  constructor(data: {
    id: string;
    learnerId: string;
    missionId: string;
    status: MissionProgressStatus;
    lessonsCompleted: number;
    lessonsTotal: number;
    comprehensionScore: number;
    timeSpentHours: number;
    startedAt?: string;
    completedAt?: string;
    createdAt: string;
    updatedAt: string;
    tenantId: string;
  }) {
    this.id = data.id;
    this.learnerId = data.learnerId;
    this.missionId = data.missionId;
    this.status = data.status;
    this.lessonsCompleted = data.lessonsCompleted;
    this.lessonsTotal = data.lessonsTotal;
    this.comprehensionScore = data.comprehensionScore;
    this.timeSpentHours = data.timeSpentHours;
    this.startedAt = data.startedAt;
    this.completedAt = data.completedAt;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.tenantId = data.tenantId;
  }

  /**
   * Create a new MissionProgress instance.
   */
  static create(data: {
    learnerId: string;
    missionId: string;
    lessonsTotal: number;
    tenantId: string;
  }): MissionProgress {
    const now = new Date().toISOString();
    return new MissionProgress({
      id: uuidv4(),
      learnerId: data.learnerId,
      missionId: data.missionId,
      status: 'not-started',
      lessonsCompleted: 0,
      lessonsTotal: data.lessonsTotal,
      comprehensionScore: 0,
      timeSpentHours: 0,
      createdAt: now,
      updatedAt: now,
      tenantId: data.tenantId,
    });
  }

  /**
   * Return new instance with updated status.
   */
  withStatus(status: MissionProgressStatus, timestamp?: string): MissionProgress {
    const ts = timestamp || new Date().toISOString();
    const updates: Record<string, unknown> = {
      status,
      updatedAt: ts,
    };

    if (status === 'in-progress' && !this.startedAt) {
      updates.startedAt = ts;
    }
    if (status === 'completed' && !this.completedAt) {
      updates.completedAt = ts;
    }

    return new MissionProgress({ ...this, ...updates } as ConstructorParameters<typeof MissionProgress>[0]);
  }

  /**
   * Return new instance with progress updated.
   */
  withLessonCompleted(comprehensionScore: number, timeSpentHours: number): MissionProgress {
    return new MissionProgress({
      ...this,
      lessonsCompleted: Math.min(this.lessonsCompleted + 1, this.lessonsTotal),
      comprehensionScore: (this.comprehensionScore + comprehensionScore) / 2, // Simple average
      timeSpentHours: this.timeSpentHours + timeSpentHours,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Get progress as percentage (0-100).
   */
  getProgressPercentage(): number {
    if (this.lessonsTotal === 0) return 0;
    return Math.round((this.lessonsCompleted / this.lessonsTotal) * 100);
  }

  /**
   * Validate progress state.
   */
  validate(): void {
    if (!this.id) throw new Error('MissionProgress id is required');
    if (!this.learnerId) throw new Error('LearnerId is required');
    if (!this.missionId) throw new Error('MissionId is required');
    if (this.lessonsCompleted < 0) throw new Error('LessonsCompleted cannot be negative');
    if (this.lessonsTotal < 0) throw new Error('LessonsTotal cannot be negative');
    if (this.lessonsCompleted > this.lessonsTotal) {
      throw new Error('LessonsCompleted cannot exceed lessonsTotal');
    }
    if (this.comprehensionScore < 0 || this.comprehensionScore > 100) {
      throw new Error('ComprehensionScore must be 0-100');
    }
  }

  /**
   * Serialize to JSON for storage.
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      learnerId: this.learnerId,
      missionId: this.missionId,
      status: this.status,
      lessonsCompleted: this.lessonsCompleted,
      lessonsTotal: this.lessonsTotal,
      comprehensionScore: this.comprehensionScore,
      timeSpentHours: this.timeSpentHours,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      tenantId: this.tenantId,
    };
  }
}
