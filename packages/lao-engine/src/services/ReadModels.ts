/**
 * Read Models - Derived projections from events.
 *
 * These are NOT the source of truth.
 * They are optimized views for answering specific questions.
 * They are rebuilt from events when needed.
 *
 * Examples:
 * - LearnerDashboard: name, current state, recent activity
 * - GoalSummary: active goals, progress, deadlines
 * - ProgressSummary: completion %, velocity, streaks
 * - AchievementSummary: unlocked achievements, credits
 * - MissionStatus: recommended, started, completed
 */

/**
 * LearnerDashboard - Overview of learner's current state.
 */
export interface LearnerDashboard {
  learnerId: string;
  name: string;
  email: string;
  state: string;
  profileImageUrl?: string;
  lastActiveAt?: string;
  onboardedAt: string;
  totalHoursLearned: number;
  completedMissionsCount: number;
  currentStreak: number;
  longestStreak: number;
  activeGoalsCount: number;
  averageGoalProgress: number;
}

/**
 * GoalSummary - Active goals with progress and deadlines.
 */
export interface GoalSummary {
  goalId: string;
  learnerId: string;
  title: string;
  description: string;
  goalType: string;
  status: string;
  progressPercentage: number;
  priority: number;
  deadline?: string;
  createdAt: string;
  updatedAt: string;
  daysRemaining?: number;
  progressVelocity?: number; // percentage points per day
}

/**
 * ProgressSummary - Aggregate metrics across all missions.
 */
export interface ProgressSummary {
  learnerId: string;
  totalMissionsStarted: number;
  totalMissionsCompleted: number;
  totalHoursSpent: number;
  averageComprehension: number;
  currentStreak: number;
  longestStreak: number;
  learningVelocityHoursPerWeek: number;
  consistencyPercentage: number; // days studied / last 30 days
  confidenceLevel: number; // 0-100 derived from comprehension scores
  skillsAcquired: Array<{
    skillId: string;
    skillName: string;
    proficiencyLevel: string;
  }>;
}

/**
 * AchievementSummary - Unlocked achievements and credits.
 */
export interface AchievementSummary {
  learnerId: string;
  totalAchievementsUnlocked: number;
  totalCredits: number;
  recentAchievements: Array<{
    achievementId: string;
    name: string;
    description: string;
    unlockedAt: string;
    creditsRewarded: number;
  }>;
  achievements: Array<{
    achievementId: string;
    name: string;
    category: string;
    isUnlocked: boolean;
    unlockedAt?: string;
  }>;
}

/**
 * MissionStatus - Learner's progress through available missions.
 */
export interface MissionStatus {
  missionId: string;
  title: string;
  description: string;
  difficulty: string;
  status: 'recommended' | 'unlocked' | 'started' | 'completed' | 'abandoned';
  progressPercentage: number;
  supportsGoalId?: string;
  teachesSkillIds: string[];
  estimatedHoursRemaining: number;
  learningVelocity?: number;
  comprehensionScore?: number;
  startedAt?: string;
  completedAt?: string;
  relatedGoals: Array<{
    goalId: string;
    title: string;
    progressPercentage: number;
  }>;
}

/**
 * LearningTimeline - Recent activity and milestones.
 */
export interface LearningTimeline {
  learnerId: string;
  events: Array<{
    eventId: string;
    eventType: string;
    title: string;
    description: string;
    timestamp: string;
    aggregateId: string;
    aggregateType: string;
    metadata?: Record<string, unknown>;
  }>;
}

/**
 * SkillProfile - Learner's skill growth over time.
 */
export interface SkillProfile {
  learnerId: string;
  skills: Array<{
    skillId: string;
    name: string;
    category: string;
    proficiencyLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    acquiredAt: string;
    utilisedAt?: string;
    practiceCount: number;
    confidenceScore: number; // 0-100
  }>;
}

/**
 * ReadModelProjector - Subscribes to events and updates read models.
 * Read models are rebuilt on-demand from event store.
 */
export class ReadModelProjector {
  private dashboards = new Map<string, LearnerDashboard>();
  private goalSummaries = new Map<string, GoalSummary[]>();
  private progressSummaries = new Map<string, ProgressSummary>();
  private achievements = new Map<string, AchievementSummary>();
  private missionStatus = new Map<string, MissionStatus[]>();
  private timelines = new Map<string, LearningTimeline>();
  private skillProfiles = new Map<string, SkillProfile>();

  /**
   * Get learner dashboard.
   * Combines learner profile, goals, progress, and streaks.
   */
  getDashboard(learnerId: string): LearnerDashboard | undefined {
    return this.dashboards.get(learnerId);
  }

  /**
   * Update dashboard on UserOnboarded or LearnerStateChanged.
   */
  updateDashboard(learnerId: string, dashboard: Partial<LearnerDashboard>) {
    const current = this.dashboards.get(learnerId) || ({} as LearnerDashboard);
    this.dashboards.set(learnerId, { ...current, ...dashboard });
  }

  /**
   * Get goal summaries for learner.
   */
  getGoalSummaries(learnerId: string): GoalSummary[] {
    return this.goalSummaries.get(learnerId) || [];
  }

  /**
   * Update goal summary on GoalCreated or GoalProgressUpdated.
   */
  updateGoalSummary(learnerId: string, goalId: string, summary: Partial<GoalSummary>) {
    const current = this.goalSummaries.get(learnerId) || [];
    const existing = current.find((g) => g.goalId === goalId);

    if (existing) {
      Object.assign(existing, summary);
    } else {
      const newGoal = { goalId, ...summary } as GoalSummary;
      current.push(newGoal);
    }

    this.goalSummaries.set(learnerId, current);
  }

  /**
   * Get progress summary for learner.
   */
  getProgressSummary(learnerId: string): ProgressSummary | undefined {
    return this.progressSummaries.get(learnerId);
  }

  /**
   * Update progress summary on MissionCompleted or LessonCompleted.
   */
  updateProgressSummary(learnerId: string, summary: Partial<ProgressSummary>) {
    const current = this.progressSummaries.get(learnerId) || ({} as ProgressSummary);
    this.progressSummaries.set(learnerId, { ...current, ...summary });
  }

  /**
   * Get achievement summary for learner.
   */
  getAchievements(learnerId: string): AchievementSummary | undefined {
    return this.achievements.get(learnerId);
  }

  /**
   * Update achievements on AchievementUnlocked or CreditsAwarded.
   */
  updateAchievements(learnerId: string, summary: Partial<AchievementSummary>) {
    const current = this.achievements.get(learnerId) || ({} as AchievementSummary);
    this.achievements.set(learnerId, { ...current, ...summary });
  }

  /**
   * Get mission status for learner.
   */
  getMissionStatus(learnerId: string): MissionStatus[] {
    return this.missionStatus.get(learnerId) || [];
  }

  /**
   * Update mission status on MissionUnlocked or MissionStarted or MissionCompleted.
   */
  updateMissionStatus(learnerId: string, missionId: string, status: Partial<MissionStatus>) {
    const current = this.missionStatus.get(learnerId) || [];
    const existing = current.find((m) => m.missionId === missionId);

    if (existing) {
      Object.assign(existing, status);
    } else {
      const newMission = { missionId, ...status } as MissionStatus;
      current.push(newMission);
    }

    this.missionStatus.set(learnerId, current);
  }

  /**
   * Get learning timeline for learner.
   */
  getTimeline(learnerId: string): LearningTimeline | undefined {
    return this.timelines.get(learnerId);
  }

  /**
   * Append event to learning timeline.
   */
  appendToTimeline(learnerId: string, event: LearningTimeline['events'][0]) {
    const current = this.timelines.get(learnerId) || { learnerId, events: [] };
    current.events.push(event);
    // Keep last 100 events in timeline
    if (current.events.length > 100) {
      current.events = current.events.slice(-100);
    }
    this.timelines.set(learnerId, current);
  }

  /**
   * Get skill profile for learner.
   */
  getSkillProfile(learnerId: string): SkillProfile | undefined {
    return this.skillProfiles.get(learnerId);
  }

  /**
   * Update skill on CompetencyUpdated or MissionCompleted.
   */
  updateSkillProfile(learnerId: string, skillId: string, skill: Partial<any>) {
    const current = this.skillProfiles.get(learnerId) || { learnerId, skills: [] };
    const existing = current.skills.find((s) => s.skillId === skillId);

    if (existing) {
      Object.assign(existing, skill);
    } else if (skill.name && skill.category && skill.proficiencyLevel && skill.acquiredAt !== undefined && skill.practiceCount !== undefined && skill.confidenceScore !== undefined) {
      const newSkill = { skillId, ...skill } as any;
      current.skills.push(newSkill);
    }
    // Only add skill if we have all required fields

    this.skillProfiles.set(learnerId, current);
  }

  /**
   * Clear all projections for a learner (for testing).
   */
  clearLearner(learnerId: string) {
    this.dashboards.delete(learnerId);
    this.goalSummaries.delete(learnerId);
    this.progressSummaries.delete(learnerId);
    this.achievements.delete(learnerId);
    this.missionStatus.delete(learnerId);
    this.timelines.delete(learnerId);
    this.skillProfiles.delete(learnerId);
  }

  /**
   * Clear all projections.
   */
  clear() {
    this.dashboards.clear();
    this.goalSummaries.clear();
    this.progressSummaries.clear();
    this.achievements.clear();
    this.missionStatus.clear();
    this.timelines.clear();
    this.skillProfiles.clear();
  }
}
