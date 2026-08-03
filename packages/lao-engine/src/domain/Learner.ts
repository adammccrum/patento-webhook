import { v4 as uuidv4 } from 'uuid';

/**
 * Learner represents a user in the learning system.
 * This is the root aggregate for learner-related data.
 * Immutable: all changes produce new instances via with* methods.
 */
export interface LearnerProfile {
  onboardedAt: string; // ISO 8601
  lastActiveAt?: string; // ISO 8601
  totalHoursLearned: number;
  completedMissionsCount: number;
  currentStreak: number;
  longestStreak: number;
}

export interface LearnerPreferences {
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  pacePreference: 'slow' | 'normal' | 'fast';
  availableHoursPerWeek: number;
  preferredLanguage: string;
  timezone: string;
  topicsOfInterest: string[];
  careersOfInterest: string[];
}

export type LearnerState = 'onboarding' | 'active' | 'paused' | 'inactive' | 'deactivated' | 'suspended';

export class Learner {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly preferences: LearnerPreferences;
  readonly profile: LearnerProfile;
  readonly state: LearnerState;
  readonly tenantId: string;
  readonly createdAt: string; // ISO 8601
  readonly updatedAt: string; // ISO 8601

  constructor(data: {
    id: string;
    email: string;
    name: string;
    preferences: LearnerPreferences;
    profile: LearnerProfile;
    state: LearnerState;
    tenantId: string;
    createdAt: string;
    updatedAt: string;
  }) {
    this.id = data.id;
    this.email = data.email;
    this.name = data.name;
    this.preferences = { ...data.preferences };
    this.profile = { ...data.profile };
    this.state = data.state;
    this.tenantId = data.tenantId;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  /**
   * Create a new Learner instance (factory method).
   */
  static create(data: {
    email: string;
    name: string;
    preferences: LearnerPreferences;
    tenantId: string;
  }): Learner {
    const now = new Date().toISOString();
    return new Learner({
      id: uuidv4(),
      email: data.email,
      name: data.name,
      preferences: data.preferences,
      profile: {
        onboardedAt: now,
        totalHoursLearned: 0,
        completedMissionsCount: 0,
        currentStreak: 0,
        longestStreak: 0,
      },
      state: 'onboarding',
      tenantId: data.tenantId,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Return new instance with updated preferences (immutable pattern).
   */
  withPreferences(preferences: Partial<LearnerPreferences>): Learner {
    return new Learner({
      ...this,
      preferences: { ...this.preferences, ...preferences },
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Return new instance with updated state.
   */
  withState(state: LearnerState): Learner {
    return new Learner({
      ...this,
      state,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Return new instance with updated profile.
   */
  withProfile(profile: Partial<LearnerProfile>): Learner {
    return new Learner({
      ...this,
      profile: { ...this.profile, ...profile },
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Return new instance with last active time updated.
   */
  withLastActiveAt(timestamp: string): Learner {
    return new Learner({
      ...this,
      profile: {
        ...this.profile,
        lastActiveAt: timestamp,
      },
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Validate learner state for invariants.
   */
  validate(): void {
    if (!this.id) throw new Error('Learner id is required');
    if (!this.email || !this.email.includes('@')) throw new Error('Valid email is required');
    if (!this.name || this.name.trim().length === 0) throw new Error('Name is required');
    if (!this.tenantId) throw new Error('TenantId is required');
    if (!this.state) throw new Error('State is required');
    if (this.profile.currentStreak < 0) throw new Error('Current streak cannot be negative');
    if (this.profile.longestStreak < this.profile.currentStreak) {
      throw new Error('Longest streak cannot be less than current streak');
    }
  }

  /**
   * Serialize to JSON for storage.
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      preferences: this.preferences,
      profile: this.profile,
      state: this.state,
      tenantId: this.tenantId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
