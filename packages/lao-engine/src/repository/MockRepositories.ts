import { Learner, Goal, Mission, MissionProgress } from '../domain';
import {
  ILearnerRepository,
  IGoalRepository,
  IMissionRepository,
  IMissionProgressRepository,
  IRepositoryFactory,
} from './RepositoryInterfaces';

/**
 * Mock learner repository for testing.
 * Stores all data in memory (no persistence).
 */
export class MockLearnerRepository implements ILearnerRepository {
  private entities = new Map<string, Learner>();

  async findById(id: string): Promise<Learner | null> {
    return this.entities.get(id) || null;
  }

  async findByIds(ids: string[]): Promise<Learner[]> {
    return ids.map((id) => this.entities.get(id)).filter((e): e is Learner => !!e);
  }

  async save(entity: Learner): Promise<void> {
    entity.validate();
    this.entities.set(entity.id, entity);
  }

  async saveBatch(entities: Learner[]): Promise<void> {
    for (const entity of entities) {
      await this.save(entity);
    }
  }

  async delete(id: string): Promise<void> {
    this.entities.delete(id);
  }

  async count(): Promise<number> {
    return this.entities.size;
  }

  async query(_criteria: unknown): Promise<Learner[]> {
    return Array.from(this.entities.values());
  }

  async findByEmail(email: string): Promise<Learner | null> {
    for (const learner of this.entities.values()) {
      if (learner.email === email) return learner;
    }
    return null;
  }

  async findByTenantId(tenantId: string, limit = 100, offset = 0): Promise<Learner[]> {
    const filtered = Array.from(this.entities.values()).filter((l) => l.tenantId === tenantId);
    return filtered.slice(offset, offset + limit);
  }

  async countByTenantId(tenantId: string): Promise<number> {
    return Array.from(this.entities.values()).filter((l) => l.tenantId === tenantId).length;
  }

  async findByState(state: string, limit = 100): Promise<Learner[]> {
    return Array.from(this.entities.values())
      .filter((l) => l.state === state)
      .slice(0, limit);
  }

  clear(): void {
    this.entities.clear();
  }
}

/**
 * Mock goal repository for testing.
 */
export class MockGoalRepository implements IGoalRepository {
  private entities = new Map<string, Goal>();

  async findById(id: string): Promise<Goal | null> {
    return this.entities.get(id) || null;
  }

  async findByIds(ids: string[]): Promise<Goal[]> {
    return ids.map((id) => this.entities.get(id)).filter((e): e is Goal => !!e);
  }

  async save(entity: Goal): Promise<void> {
    entity.validate();
    this.entities.set(entity.id, entity);
  }

  async saveBatch(entities: Goal[]): Promise<void> {
    for (const entity of entities) {
      await this.save(entity);
    }
  }

  async delete(id: string): Promise<void> {
    this.entities.delete(id);
  }

  async count(): Promise<number> {
    return this.entities.size;
  }

  async query(_criteria: unknown): Promise<Goal[]> {
    return Array.from(this.entities.values());
  }

  async findByLearnerId(learnerId: string, limit = 100): Promise<Goal[]> {
    return Array.from(this.entities.values())
      .filter((g) => g.learnerId === learnerId)
      .slice(0, limit);
  }

  async findActiveByLearnerId(learnerId: string): Promise<Goal[]> {
    return Array.from(this.entities.values()).filter(
      (g) => g.learnerId === learnerId && g.status === 'active'
    );
  }

  async countByLearnerIdAndStatus(learnerId: string, status: string): Promise<number> {
    return Array.from(this.entities.values()).filter(
      (g) => g.learnerId === learnerId && g.status === status
    ).length;
  }

  clear(): void {
    this.entities.clear();
  }
}

/**
 * Mock mission repository for testing.
 */
export class MockMissionRepository implements IMissionRepository {
  private entities = new Map<string, Mission>();

  async findById(id: string): Promise<Mission | null> {
    return this.entities.get(id) || null;
  }

  async findByIds(ids: string[]): Promise<Mission[]> {
    return ids.map((id) => this.entities.get(id)).filter((e): e is Mission => !!e);
  }

  async save(entity: Mission): Promise<void> {
    entity.validate();
    this.entities.set(entity.id, entity);
  }

  async saveBatch(entities: Mission[]): Promise<void> {
    for (const entity of entities) {
      await this.save(entity);
    }
  }

  async delete(id: string): Promise<void> {
    this.entities.delete(id);
  }

  async count(): Promise<number> {
    return this.entities.size;
  }

  async query(_criteria: unknown): Promise<Mission[]> {
    return Array.from(this.entities.values());
  }

  async findBySlug(slug: string, _tenantId: string): Promise<Mission | null> {
    for (const mission of this.entities.values()) {
      if (mission.slug === slug) return mission;
    }
    return null;
  }

  async findActive(limit = 100, offset = 0): Promise<Mission[]> {
    return Array.from(this.entities.values())
      .filter((m) => m.isActive)
      .slice(offset, offset + limit);
  }

  async findByDifficulty(difficulty: string, limit = 100): Promise<Mission[]> {
    return Array.from(this.entities.values())
      .filter((m) => m.difficulty === difficulty)
      .slice(0, limit);
  }

  async findByTeachesSkill(skillId: string): Promise<Mission[]> {
    return Array.from(this.entities.values()).filter((m) =>
      m.teachesSkillIds.includes(skillId)
    );
  }

  async findByRequiresSkill(skillId: string): Promise<Mission[]> {
    return Array.from(this.entities.values()).filter((m) =>
      m.requiresSkillIds.includes(skillId)
    );
  }

  async findBySupportsGoal(goalId: string): Promise<Mission[]> {
    return Array.from(this.entities.values()).filter((m) =>
      m.supportsGoalIds.includes(goalId)
    );
  }

  clear(): void {
    this.entities.clear();
  }
}

/**
 * Mock mission progress repository for testing.
 */
export class MockMissionProgressRepository implements IMissionProgressRepository {
  private entities = new Map<string, MissionProgress>();

  async findById(id: string): Promise<MissionProgress | null> {
    return this.entities.get(id) || null;
  }

  async findByIds(ids: string[]): Promise<MissionProgress[]> {
    return ids.map((id) => this.entities.get(id)).filter((e): e is MissionProgress => !!e);
  }

  async save(entity: MissionProgress): Promise<void> {
    entity.validate();
    this.entities.set(entity.id, entity);
  }

  async saveBatch(entities: MissionProgress[]): Promise<void> {
    for (const entity of entities) {
      await this.save(entity);
    }
  }

  async delete(id: string): Promise<void> {
    this.entities.delete(id);
  }

  async count(): Promise<number> {
    return this.entities.size;
  }

  async query(_criteria: unknown): Promise<MissionProgress[]> {
    return Array.from(this.entities.values());
  }

  async findByLearnerAndMission(learnerId: string, missionId: string): Promise<MissionProgress | null> {
    for (const progress of this.entities.values()) {
      if (progress.learnerId === learnerId && progress.missionId === missionId) {
        return progress;
      }
    }
    return null;
  }

  async findByLearnerId(learnerId: string): Promise<MissionProgress[]> {
    return Array.from(this.entities.values()).filter((p) => p.learnerId === learnerId);
  }

  async findByStatus(status: string, limit = 100): Promise<MissionProgress[]> {
    return Array.from(this.entities.values())
      .filter((p) => p.status === status)
      .slice(0, limit);
  }

  async countCompletedByLearnerId(learnerId: string): Promise<number> {
    return Array.from(this.entities.values()).filter(
      (p) => p.learnerId === learnerId && p.status === 'completed'
    ).length;
  }

  async getSummaryForLearner(learnerId: string): Promise<{
    totalCompleted: number;
    totalHoursSpent: number;
    averageComprehension: number;
  }> {
    const progressList = Array.from(this.entities.values()).filter(
      (p) => p.learnerId === learnerId && p.status === 'completed'
    );

    const totalCompleted = progressList.length;
    const totalHoursSpent = progressList.reduce((sum, p) => sum + p.timeSpentHours, 0);
    const averageComprehension =
      progressList.length > 0
        ? progressList.reduce((sum, p) => sum + p.comprehensionScore, 0) / progressList.length
        : 0;

    return { totalCompleted, totalHoursSpent, averageComprehension };
  }

  clear(): void {
    this.entities.clear();
  }
}

/**
 * Mock repository factory.
 */
export class MockRepositoryFactory implements IRepositoryFactory {
  private learnerRepo = new MockLearnerRepository();
  private goalRepo = new MockGoalRepository();
  private missionRepo = new MockMissionRepository();
  private progressRepo = new MockMissionProgressRepository();

  getLearnerRepository(): ILearnerRepository {
    return this.learnerRepo;
  }

  getGoalRepository(): IGoalRepository {
    return this.goalRepo;
  }

  getMissionRepository(): IMissionRepository {
    return this.missionRepo;
  }

  getMissionProgressRepository(): IMissionProgressRepository {
    return this.progressRepo;
  }

  clear(): void {
    this.learnerRepo.clear();
    this.goalRepo.clear();
    this.missionRepo.clear();
    this.progressRepo.clear();
  }
}
