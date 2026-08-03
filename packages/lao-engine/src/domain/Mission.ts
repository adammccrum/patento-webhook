import { v4 as uuidv4 } from 'uuid';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';

/**
 * Mission represents a unit of learning work that teaches specific skills.
 * Immutable.
 */
export class Mission {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly description: string;
  readonly objective: string;
  readonly difficulty: Difficulty;
  readonly estimatedDurationHours: number;

  // Relationships
  readonly teachesSkillIds: string[];
  readonly requiresSkillIds: string[]; // Prerequisites
  readonly supportsGoalIds: string[];

  // Structure
  readonly lessonCount: number;
  readonly assessmentCount: number;

  // Metadata
  readonly createdAt: string; // ISO 8601
  readonly updatedAt: string; // ISO 8601
  readonly isActive: boolean;
  readonly popularity: number; // 0-100, based on completion rate
  readonly tenantId: string;

  constructor(data: {
    id: string;
    title: string;
    slug: string;
    description: string;
    objective: string;
    difficulty: Difficulty;
    estimatedDurationHours: number;
    teachesSkillIds: string[];
    requiresSkillIds: string[];
    supportsGoalIds: string[];
    lessonCount: number;
    assessmentCount: number;
    createdAt: string;
    updatedAt: string;
    isActive: boolean;
    popularity: number;
    tenantId: string;
  }) {
    this.id = data.id;
    this.title = data.title;
    this.slug = data.slug;
    this.description = data.description;
    this.objective = data.objective;
    this.difficulty = data.difficulty;
    this.estimatedDurationHours = data.estimatedDurationHours;
    this.teachesSkillIds = [...data.teachesSkillIds];
    this.requiresSkillIds = [...data.requiresSkillIds];
    this.supportsGoalIds = [...data.supportsGoalIds];
    this.lessonCount = data.lessonCount;
    this.assessmentCount = data.assessmentCount;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.isActive = data.isActive;
    this.popularity = data.popularity;
    this.tenantId = data.tenantId;
  }

  /**
   * Create a new Mission instance (factory method).
   */
  static create(data: {
    title: string;
    slug: string;
    description: string;
    objective: string;
    difficulty: Difficulty;
    estimatedDurationHours: number;
    teachesSkillIds: string[];
    requiresSkillIds?: string[];
    supportsGoalIds?: string[];
    lessonCount?: number;
    assessmentCount?: number;
    tenantId: string;
  }): Mission {
    const now = new Date().toISOString();
    return new Mission({
      id: uuidv4(),
      title: data.title,
      slug: data.slug,
      description: data.description,
      objective: data.objective,
      difficulty: data.difficulty,
      estimatedDurationHours: data.estimatedDurationHours,
      teachesSkillIds: data.teachesSkillIds,
      requiresSkillIds: data.requiresSkillIds || [],
      supportsGoalIds: data.supportsGoalIds || [],
      lessonCount: data.lessonCount || 0,
      assessmentCount: data.assessmentCount || 0,
      createdAt: now,
      updatedAt: now,
      isActive: true,
      popularity: 0,
      tenantId: data.tenantId,
    });
  }

  /**
   * Return new instance with updated popularity.
   */
  withPopularity(popularity: number): Mission {
    return new Mission({
      ...this,
      popularity: Math.max(0, Math.min(100, popularity)),
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Return new instance with activation status changed.
   */
  withActive(isActive: boolean): Mission {
    return new Mission({
      ...this,
      isActive,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Validate mission state for invariants.
   */
  validate(): void {
    if (!this.id) throw new Error('Mission id is required');
    if (!this.title || this.title.trim().length === 0) throw new Error('Title is required');
    if (!this.slug || this.slug.trim().length === 0) throw new Error('Slug is required');
    if (this.estimatedDurationHours <= 0) throw new Error('EstimatedDurationHours must be positive');
    if (this.teachesSkillIds.length === 0) throw new Error('Mission must teach at least one skill');
    if (this.popularity < 0 || this.popularity > 100) throw new Error('Popularity must be 0-100');
  }

  /**
   * Serialize to JSON for storage.
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      title: this.title,
      slug: this.slug,
      description: this.description,
      objective: this.objective,
      difficulty: this.difficulty,
      estimatedDurationHours: this.estimatedDurationHours,
      teachesSkillIds: this.teachesSkillIds,
      requiresSkillIds: this.requiresSkillIds,
      supportsGoalIds: this.supportsGoalIds,
      lessonCount: this.lessonCount,
      assessmentCount: this.assessmentCount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      isActive: this.isActive,
      popularity: this.popularity,
      tenantId: this.tenantId,
    };
  }
}
