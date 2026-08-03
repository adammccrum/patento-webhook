import { describe, it, expect, beforeEach } from 'vitest';
import { Goal } from '../../src/domain/Goal';

describe('Goal', () => {
  describe('Creation', () => {
    it('should create a goal with valid data', () => {
      const goal = Goal.create({
        learnerId: 'learner-123',
        title: 'Learn Machine Learning',
        description: 'Master ML concepts',
        goalType: 'skill',
        category: 'AI',
        targetValue: 5,
        targetUnit: 'projects',
        priority: 4,
        tenantId: 'tenant-1',
      });

      expect(goal.id).toBeDefined();
      expect(goal.title).toBe('Learn Machine Learning');
      expect(goal.status).toBe('draft');
      expect(goal.progressPercentage).toBe(0);
      expect(goal.priority).toBe(4);
    });

    it('should default priority to 3', () => {
      const goal = Goal.create({
        learnerId: 'learner-123',
        title: 'Test Goal',
        description: 'Description',
        goalType: 'skill',
        category: 'Test',
        targetValue: 1,
        targetUnit: 'unit',
        tenantId: 'tenant-1',
      });

      expect(goal.priority).toBe(3);
    });
  });

  describe('State transitions', () => {
    let goal: Goal;

    beforeEach(() => {
      goal = Goal.create({
        learnerId: 'learner-123',
        title: 'Test Goal',
        description: 'Description',
        goalType: 'skill',
        category: 'Test',
        targetValue: 1,
        targetUnit: 'unit',
        tenantId: 'tenant-1',
      });
    });

    it('should transition draft → active', () => {
      expect(goal.canTransitionTo('active')).toBe(true);
    });

    it('should transition draft → abandoned', () => {
      expect(goal.canTransitionTo('abandoned')).toBe(true);
    });

    it('should NOT transition draft → achieved', () => {
      expect(goal.canTransitionTo('achieved')).toBe(false);
    });

    it('should transition active → paused', () => {
      const active = goal.withStatus('active');
      expect(active.canTransitionTo('paused')).toBe(true);
    });

    it('should transition active → achieved (only with 100% progress)', () => {
      const active = goal.withStatus('active');
      expect(active.canTransitionTo('achieved')).toBe(true);
    });

    it('should NOT transition from achieved', () => {
      const achieved = goal.withStatus('achieved', new Date().toISOString());
      expect(achieved.canTransitionTo('active')).toBe(false);
      expect(achieved.canTransitionTo('archived')).toBe(true); // Only to archived
    });

    it('should NOT transition from abandoned (except to archived)', () => {
      const abandoned = goal.withStatus('abandoned');
      expect(abandoned.canTransitionTo('active')).toBe(false);
      expect(abandoned.canTransitionTo('archived')).toBe(true);
    });
  });

  describe('Immutability', () => {
    let goal: Goal;

    beforeEach(() => {
      goal = Goal.create({
        learnerId: 'learner-123',
        title: 'Test Goal',
        description: 'Description',
        goalType: 'skill',
        category: 'Test',
        targetValue: 1,
        targetUnit: 'unit',
        tenantId: 'tenant-1',
      });
    });

    it('should update progress and return new instance', () => {
      const updated = goal.withProgress(50);

      expect(updated).not.toBe(goal);
      expect(goal.progressPercentage).toBe(0);
      expect(updated.progressPercentage).toBe(50);
    });

    it('should clamp progress to 0-100', () => {
      const tooHigh = goal.withProgress(150);
      const tooLow = goal.withProgress(-10);

      expect(tooHigh.progressPercentage).toBe(100);
      expect(tooLow.progressPercentage).toBe(0);
    });

    it('should update status and return new instance', () => {
      const updated = goal.withStatus('active');

      expect(updated).not.toBe(goal);
      expect(goal.status).toBe('draft');
      expect(updated.status).toBe('active');
    });

    it('should update priority and return new instance', () => {
      const updated = goal.withPriority(5);

      expect(updated).not.toBe(goal);
      expect(goal.priority).toBe(3);
      expect(updated.priority).toBe(5);
    });

    it('should clamp priority to 1-5', () => {
      const tooHigh = goal.withPriority(10);
      const tooLow = goal.withPriority(0);

      expect(tooHigh.priority).toBe(5);
      expect(tooLow.priority).toBe(1);
    });
  });

  describe('Validation', () => {
    it('should reject empty title', () => {
      const invalidGoal = Goal.create({
        learnerId: 'learner-123',
        title: '  ', // Empty
        description: 'Description',
        goalType: 'skill',
        category: 'Test',
        targetValue: 1,
        targetUnit: 'unit',
        tenantId: 'tenant-1',
      });

      expect(() => invalidGoal.validate()).toThrow('Title is required');
    });

    it('should reject non-positive target value', () => {
      const invalidGoal = Goal.create({
        learnerId: 'learner-123',
        title: 'Test',
        description: 'Description',
        goalType: 'skill',
        category: 'Test',
        targetValue: 0, // Invalid
        targetUnit: 'unit',
        tenantId: 'tenant-1',
      });

      expect(() => invalidGoal.validate()).toThrow('TargetValue must be positive');
    });

    it('should reject invalid progress percentage', () => {
      const goal = Goal.create({
        learnerId: 'learner-123',
        title: 'Test',
        description: 'Description',
        goalType: 'skill',
        category: 'Test',
        targetValue: 1,
        targetUnit: 'unit',
        tenantId: 'tenant-1',
      });

      const invalidGoal = new Goal({ ...goal, progressPercentage: 150 });

      expect(() => invalidGoal.validate()).toThrow('ProgressPercentage must be 0-100');
    });

    it('should reject achieved goal without 100% progress', () => {
      const goal = Goal.create({
        learnerId: 'learner-123',
        title: 'Test',
        description: 'Description',
        goalType: 'skill',
        category: 'Test',
        targetValue: 1,
        targetUnit: 'unit',
        tenantId: 'tenant-1',
      });

      const invalidGoal = new Goal({
        ...goal,
        status: 'achieved',
        progressPercentage: 90, // < 100
      });

      expect(() => invalidGoal.validate()).toThrow('Cannot achieve goal with less than 100% progress');
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON', () => {
      const goal = Goal.create({
        learnerId: 'learner-123',
        title: 'Test Goal',
        description: 'Description',
        goalType: 'skill',
        category: 'Test',
        targetValue: 5,
        targetUnit: 'projects',
        tenantId: 'tenant-1',
      });

      const json = goal.toJSON();

      expect(json.id).toBe(goal.id);
      expect(json.title).toBe('Test Goal');
      expect(json.status).toBe('draft');
      expect(json.progressPercentage).toBe(0);
      expect(typeof json.createdAt).toBe('string');
    });
  });
});
