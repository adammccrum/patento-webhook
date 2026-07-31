import { Learner, Goal, Mission, MissionProgress } from '../domain';
import { IRepository } from './IRepository';

/**
 * Learner repository interface.
 * Additional methods for learner-specific queries.
 */
export interface ILearnerRepository extends IRepository<Learner> {
  /**
   * Find learner by email (unique constraint).
   */
  findByEmail(email: string): Promise<Learner | null>;

  /**
   * Find all learners in a tenant.
   */
  findByTenantId(tenantId: string, limit?: number, offset?: number): Promise<Learner[]>;

  /**
   * Count learners in a tenant.
   */
  countByTenantId(tenantId: string): Promise<number>;

  /**
   * Find learners by state.
   */
  findByState(state: string, limit?: number): Promise<Learner[]>;
}

/**
 * Goal repository interface.
 */
export interface IGoalRepository extends IRepository<Goal> {
  /**
   * Find all goals for a learner.
   */
  findByLearnerId(learnerId: string, limit?: number): Promise<Goal[]>;

  /**
   * Find active goals for a learner.
   */
  findActiveByLearnerId(learnerId: string): Promise<Goal[]>;

  /**
   * Count goals for a learner by status.
   */
  countByLearnerIdAndStatus(learnerId: string, status: string): Promise<number>;
}

/**
 * Mission repository interface.
 */
export interface IMissionRepository extends IRepository<Mission> {
  /**
   * Find mission by slug (unique within tenant).
   */
  findBySlug(slug: string, tenantId: string): Promise<Mission | null>;

  /**
   * Find all active missions.
   */
  findActive(limit?: number, offset?: number): Promise<Mission[]>;

  /**
   * Find missions by difficulty.
   */
  findByDifficulty(difficulty: string, limit?: number): Promise<Mission[]>;

  /**
   * Find missions that teach a specific skill.
   */
  findByTeachesSkill(skillId: string): Promise<Mission[]>;

  /**
   * Find missions that require a specific skill (prerequisite).
   */
  findByRequiresSkill(skillId: string): Promise<Mission[]>;

  /**
   * Find missions that support a goal.
   */
  findBySupportsGoal(goalId: string): Promise<Mission[]>;
}

/**
 * Mission progress repository interface.
 */
export interface IMissionProgressRepository extends IRepository<MissionProgress> {
  /**
   * Find progress for a specific learner-mission pair.
   * Unique constraint: (learnerId, missionId).
   */
  findByLearnerAndMission(learnerId: string, missionId: string): Promise<MissionProgress | null>;

  /**
   * Find all progress records for a learner.
   */
  findByLearnerId(learnerId: string): Promise<MissionProgress[]>;

  /**
   * Find progress records by status.
   */
  findByStatus(status: string, limit?: number): Promise<MissionProgress[]>;

  /**
   * Count completed missions for a learner.
   */
  countCompletedByLearnerId(learnerId: string): Promise<number>;

  /**
   * Get summary stats for a learner (for Progress service).
   */
  getSummaryForLearner(learnerId: string): Promise<{
    totalCompleted: number;
    totalHoursSpent: number;
    averageComprehension: number;
  }>;
}

/**
 * Repository factory for dependency injection.
 * Implementations provide concrete repositories.
 */
export interface IRepositoryFactory {
  getLearnerRepository(): ILearnerRepository;
  getGoalRepository(): IGoalRepository;
  getMissionRepository(): IMissionRepository;
  getMissionProgressRepository(): IMissionProgressRepository;
}
