import { describe, it, expect, beforeEach } from 'vitest';
import { MockLearnerRepository, MockGoalRepository, MockRepositoryFactory } from '../../src/repository';
import { Learner, Goal } from '../../src/domain';

describe('MockRepositories', () => {
  describe('MockLearnerRepository', () => {
    let repo: MockLearnerRepository;
    let learner: Learner;

    beforeEach(() => {
      repo = new MockLearnerRepository();
      learner = Learner.create({
        email: 'test@example.com',
        name: 'John Doe',
        preferences: {
          learningStyle: 'visual',
          pacePreference: 'normal',
          availableHoursPerWeek: 10,
          preferredLanguage: 'en',
          timezone: 'UTC',
          topicsOfInterest: [],
          careersOfInterest: [],
        },
        tenantId: 'tenant-1',
      });
    });

    it('should save and retrieve learner', async () => {
      await repo.save(learner);

      const retrieved = await repo.findById(learner.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.email).toBe('test@example.com');
    });

    it('should find learner by email', async () => {
      await repo.save(learner);

      const retrieved = await repo.findByEmail('test@example.com');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(learner.id);
    });

    it('should return null for non-existent email', async () => {
      const retrieved = await repo.findByEmail('nonexistent@example.com');

      expect(retrieved).toBeNull();
    });

    it('should find learners by tenant', async () => {
      const learner2 = Learner.create({
        email: 'test2@example.com',
        name: 'Jane Doe',
        preferences: {
          learningStyle: 'auditory',
          pacePreference: 'fast',
          availableHoursPerWeek: 20,
          preferredLanguage: 'en',
          timezone: 'UTC',
          topicsOfInterest: [],
          careersOfInterest: [],
        },
        tenantId: 'tenant-1',
      });

      await repo.save(learner);
      await repo.save(learner2);

      const retrieved = await repo.findByTenantId('tenant-1');

      expect(retrieved).toHaveLength(2);
      expect(retrieved.map((l) => l.id)).toContain(learner.id);
      expect(retrieved.map((l) => l.id)).toContain(learner2.id);
    });

    it('should count learners by tenant', async () => {
      await repo.save(learner);

      const count = await repo.countByTenantId('tenant-1');

      expect(count).toBe(1);
    });

    it('should find learners by state', async () => {
      const active = learner.withState('active');
      await repo.save(active);

      const retrieved = await repo.findByState('active');

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].state).toBe('active');
    });

    it('should validate learner on save', async () => {
      const invalidLearner = new Learner({
        ...learner,
        id: '', // Invalid
      });

      await expect(repo.save(invalidLearner)).rejects.toThrow();
    });

    it('should return null for non-existent ID', async () => {
      const retrieved = await repo.findById('nonexistent');

      expect(retrieved).toBeNull();
    });

    it('should delete learner', async () => {
      await repo.save(learner);
      expect(await repo.findById(learner.id)).not.toBeNull();

      await repo.delete(learner.id);

      expect(await repo.findById(learner.id)).toBeNull();
    });

    it('should count total learners', async () => {
      await repo.save(learner);

      const count = await repo.count();

      expect(count).toBe(1);
    });
  });

  describe('MockGoalRepository', () => {
    let repo: MockGoalRepository;
    let goal: Goal;

    beforeEach(() => {
      repo = new MockGoalRepository();
      goal = Goal.create({
        learnerId: 'learner-123',
        title: 'Learn ML',
        description: 'Master machine learning',
        goalType: 'skill',
        category: 'AI',
        targetValue: 5,
        targetUnit: 'projects',
        tenantId: 'tenant-1',
      });
    });

    it('should save and retrieve goal', async () => {
      await repo.save(goal);

      const retrieved = await repo.findById(goal.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.title).toBe('Learn ML');
    });

    it('should find goals by learner', async () => {
      const goal2 = Goal.create({
        learnerId: 'learner-123',
        title: 'Learn Python',
        description: 'Master Python',
        goalType: 'skill',
        category: 'Programming',
        targetValue: 1,
        targetUnit: 'certification',
        tenantId: 'tenant-1',
      });

      await repo.save(goal);
      await repo.save(goal2);

      const retrieved = await repo.findByLearnerId('learner-123');

      expect(retrieved).toHaveLength(2);
    });

    it('should find active goals by learner', async () => {
      const active = goal.withStatus('active');
      const inactive = goal.withStatus('draft');

      await repo.save(active);
      const goal2 = Goal.create({
        learnerId: 'learner-123',
        title: 'Another Goal',
        description: 'Description',
        goalType: 'skill',
        category: 'Test',
        targetValue: 1,
        targetUnit: 'unit',
        tenantId: 'tenant-1',
      });
      await repo.save(goal2);

      const active_goals = await repo.findActiveByLearnerId('learner-123');

      expect(active_goals).toHaveLength(1);
      expect(active_goals[0].status).toBe('active');
    });

    it('should count goals by learner and status', async () => {
      const active = goal.withStatus('active');
      await repo.save(active);

      const count = await repo.countByLearnerIdAndStatus('learner-123', 'active');

      expect(count).toBe(1);
    });
  });

  describe('MockRepositoryFactory', () => {
    let factory: MockRepositoryFactory;

    beforeEach(() => {
      factory = new MockRepositoryFactory();
    });

    it('should provide learner repository', () => {
      const repo = factory.getLearnerRepository();

      expect(repo).toBeDefined();
      expect(repo.findById).toBeDefined();
    });

    it('should provide goal repository', () => {
      const repo = factory.getGoalRepository();

      expect(repo).toBeDefined();
      expect(repo.findById).toBeDefined();
    });

    it('should provide mission repository', () => {
      const repo = factory.getMissionRepository();

      expect(repo).toBeDefined();
      expect(repo.findById).toBeDefined();
    });

    it('should provide mission progress repository', () => {
      const repo = factory.getMissionProgressRepository();

      expect(repo).toBeDefined();
      expect(repo.findById).toBeDefined();
    });

    it('should clear all repositories', async () => {
      const learnerRepo = factory.getLearnerRepository();
      const learner = Learner.create({
        email: 'test@example.com',
        name: 'John Doe',
        preferences: {
          learningStyle: 'visual',
          pacePreference: 'normal',
          availableHoursPerWeek: 10,
          preferredLanguage: 'en',
          timezone: 'UTC',
          topicsOfInterest: [],
          careersOfInterest: [],
        },
        tenantId: 'tenant-1',
      });

      await learnerRepo.save(learner);
      expect(await learnerRepo.count()).toBe(1);

      factory.clear();

      expect(await learnerRepo.count()).toBe(0);
    });
  });
});
