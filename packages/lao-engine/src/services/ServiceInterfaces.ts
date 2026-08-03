import { Learner, Goal, Mission, MissionProgress, LearnerPreferences } from '../domain';
import { DomainEvent } from '../events';

/**
 * Service interface contract.
 * All services implement this to ensure consistency.
 */
export interface IService {
  /**
   * Health check.
   */
  health(): Promise<boolean>;

  /**
   * Handle a domain event (event subscription).
   * Services react to events from other services.
   * Must be idempotent.
   */
  handleEvent(event: DomainEvent): Promise<void>;
}

/**
 * Learner Service.
 * Owns: learner identity, preferences, activity tracking.
 * Produces: UserOnboarded, LearnerPreferencesUpdated, LearnerStateChanged.
 * Consumes: (none - root service).
 */
export interface ILearnerService extends IService {
  /**
   * Create a new learner (onboarding).
   */
  createLearner(data: {
    email: string;
    name: string;
    preferences: LearnerPreferences;
    tenantId: string;
  }): Promise<Learner>;

  /**
   * Get learner by ID.
   */
  getLearner(learnerId: string): Promise<Learner | null>;

  /**
   * Get learner by email.
   */
  getLearnerByEmail(email: string): Promise<Learner | null>;

  /**
   * Update learner preferences.
   */
  updatePreferences(learnerId: string, preferences: Partial<LearnerPreferences>): Promise<Learner>;

  /**
   * Update learner state (active, paused, inactive, etc).
   */
  updateState(learnerId: string, state: string): Promise<Learner>;

  /**
   * Record learner activity (updates lastActiveAt).
   */
  recordActivity(learnerId: string): Promise<Learner>;
}

/**
 * Goal Service.
 * Owns: goal definitions, progress tracking, achievement checking.
 * Produces: GoalCreated, GoalProgressUpdated, GoalAchieved, GoalAbandoned.
 * Consumes: MissionCompleted.
 */
export interface IGoalService extends IService {
  /**
   * Create a new goal.
   */
  createGoal(data: {
    learnerId: string;
    title: string;
    description: string;
    goalType: string;
    category: string;
    targetValue: number;
    targetUnit: string;
    deadline?: string;
    priority?: number;
    tenantId: string;
  }): Promise<Goal>;

  /**
   * Get goal by ID.
   */
  getGoal(goalId: string): Promise<Goal | null>;

  /**
   * Get all goals for a learner.
   */
  getGoalsByLearner(learnerId: string): Promise<Goal[]>;

  /**
   * Update goal progress.
   */
  updateProgress(goalId: string, progressPercentage: number): Promise<Goal>;

  /**
   * Mark goal as achieved.
   */
  markAchieved(goalId: string): Promise<Goal>;

  /**
   * Mark goal as abandoned.
   */
  markAbandoned(goalId: string, reason?: string): Promise<Goal>;
}

/**
 * Mission Service.
 * Owns: mission catalog, lessons, assessments, unlock criteria.
 * Produces: MissionUnlocked.
 * Consumes: (mostly queries, minimal events).
 */
export interface IMissionService extends IService {
  /**
   * Get mission by ID.
   */
  getMission(missionId: string): Promise<Mission | null>;

  /**
   * Get all missions.
   */
  getAllMissions(limit?: number, offset?: number): Promise<Mission[]>;

  /**
   * Get missions by difficulty.
   */
  getMissionsByDifficulty(difficulty: string): Promise<Mission[]>;

  /**
   * Get missions that teach a skill.
   */
  getMissionsByTeachesSkill(skillId: string): Promise<Mission[]>;

  /**
   * Check if learner can unlock a mission (prerequisites met).
   */
  canUnlockMission(learnerId: string, missionId: string): Promise<boolean>;

  /**
   * Get missions that support a goal.
   */
  getMissionsByGoal(goalId: string): Promise<Mission[]>;
}

/**
 * Progress Service.
 * Owns: progress aggregation, velocity calculation, streak tracking.
 * Produces: (none - derived data, internal only).
 * Consumes: MissionStarted, MissionCompleted, LessonCompleted, MissionAbandoned.
 */
export interface IProgressService extends IService {
  /**
   * Get progress for a learner-mission pair.
   */
  getProgress(learnerId: string, missionId: string): Promise<MissionProgress | null>;

  /**
   * Get all progress for a learner.
   */
  getProgressByLearner(learnerId: string): Promise<MissionProgress[]>;

  /**
   * Get progress summary for learner (total hours, completions, etc).
   */
  getSummary(learnerId: string): Promise<{
    totalCompleted: number;
    totalHoursSpent: number;
    averageComprehension: number;
    currentStreak: number;
  }>;

  /**
   * Start a mission (transition to in-progress).
   */
  startMission(learnerId: string, missionId: string): Promise<MissionProgress>;

  /**
   * Complete a mission (all assessments passed).
   */
  completeMission(
    learnerId: string,
    missionId: string,
    comprehensionScore: number,
    timeSpentHours: number
  ): Promise<MissionProgress>;

  /**
   * Abandon a mission.
   */
  abandonMission(learnerId: string, missionId: string): Promise<MissionProgress>;
}

/**
 * Learning Path Service.
 * Owns: learning path generation, sequencing, dynamic reordering.
 * Produces: LearningPathGenerated, LearningPathReordered, LearningPathCompleted.
 * Consumes: GoalCreated, CompetencyUpdated, MissionCompleted.
 */
export interface ILearningPathService extends IService {
  /**
   * Generate a learning path for a goal.
   * Delegates ranking to RecommendationEngine.
   */
  generatePath(learnerId: string, goalId: string): Promise<unknown>; // LearningPath

  /**
   * Get learning path by ID.
   */
  getPath(pathId: string): Promise<unknown | null>;

  /**
   * Get paths for a learner.
   */
  getPathsByLearner(learnerId: string): Promise<unknown[]>;

  /**
   * Reorder a path based on new information.
   */
  reorderPath(pathId: string): Promise<unknown>;

  /**
   * Check if all missions in a path are completed.
   */
  isPathComplete(pathId: string): Promise<boolean>;
}

/**
 * Recommendation Engine.
 * Owns: mission ranking, strategy selection, path generation logic.
 * Produces: (none - query service).
 * Consumes: (none - reads from services).
 */
export interface IRecommendationEngine extends IService {
  /**
   * Generate ranked missions for a goal.
   */
  recommendMissionsForGoal(
    learnerId: string,
    goalId: string,
    limit?: number
  ): Promise<Array<{ missionId: string; score: number; reason: string }>>;

  /**
   * Generate ranked missions for a learner to fill knowledge gaps.
   */
  recommendMissionsForGaps(
    learnerId: string,
    limit?: number
  ): Promise<Array<{ missionId: string; score: number; reason: string }>>;

  /**
   * Score a mission's relevance to a learner.
   */
  scoreMission(learnerId: string, missionId: string): Promise<number>;
}

/**
 * Achievement Service.
 * Owns: achievement definitions, unlock criteria, credit system.
 * Produces: AchievementUnlocked, CreditsAwarded.
 * Consumes: MissionCompleted, GoalAchieved, CompetencyUpdated.
 */
export interface IAchievementService extends IService {
  /**
   * Get learner's achievements.
   */
  getAchievements(learnerId: string): Promise<unknown[]>; // Achievement[]

  /**
   * Evaluate and unlock achievements for learner.
   * (Called reactively on relevant events).
   */
  evaluateUnlockCriteria(learnerId: string): Promise<unknown[]>;

  /**
   * Get learner's credit balance.
   */
  getCredits(learnerId: string): Promise<number>;

  /**
   * Award credits to learner.
   */
  awardCredits(learnerId: string, amount: number, reason: string): Promise<number>;
}

/**
 * Assessment Service (Phase 1 definition, implementation in Phase 3).
 * Owns: assessment definitions, grading, results.
 * Produces: AssessmentAttempted, AssessmentPassed, AssessmentFailed.
 * Consumes: (none - root service).
 */
export interface IAssessmentService extends IService {
  /**
   * Submit an assessment attempt.
   */
  submitAssessment(
    learnerId: string,
    assessmentId: string,
    answers: unknown
  ): Promise<{ passed: boolean; score: number; feedback: string }>;

  /**
   * Get assessment results for a learner.
   */
  getResults(learnerId: string, assessmentId: string): Promise<unknown[]>;
}
