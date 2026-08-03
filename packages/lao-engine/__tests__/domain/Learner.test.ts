import { describe, it, expect, beforeEach } from 'vitest';
import { Learner } from '../../src/domain/Learner';

describe('Learner', () => {
  describe('Creation', () => {
    it('should create a learner with valid data', () => {
      const learner = Learner.create({
        email: 'test@example.com',
        name: 'John Doe',
        preferences: {
          learningStyle: 'visual',
          pacePreference: 'normal',
          availableHoursPerWeek: 10,
          preferredLanguage: 'en',
          timezone: 'UTC',
          topicsOfInterest: ['AI', 'ML'],
          careersOfInterest: ['Data Scientist'],
        },
        tenantId: 'tenant-1',
      });

      expect(learner.id).toBeDefined();
      expect(learner.email).toBe('test@example.com');
      expect(learner.name).toBe('John Doe');
      expect(learner.state).toBe('onboarding');
      expect(learner.profile.totalHoursLearned).toBe(0);
      expect(learner.profile.completedMissionsCount).toBe(0);
    });

    it('should initialize with zero metrics', () => {
      const learner = Learner.create({
        email: 'test@example.com',
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

      expect(learner.profile.currentStreak).toBe(0);
      expect(learner.profile.longestStreak).toBe(0);
      expect(learner.profile.totalHoursLearned).toBe(0);
    });
  });

  describe('Immutability', () => {
    let learner: Learner;

    beforeEach(() => {
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

    it('should update preferences and return new instance', () => {
      const updated = learner.withPreferences({
        pacePreference: 'fast',
        availableHoursPerWeek: 20,
      });

      expect(updated).not.toBe(learner);
      expect(learner.preferences.pacePreference).toBe('normal');
      expect(updated.preferences.pacePreference).toBe('fast');
      expect(updated.preferences.learningStyle).toBe('visual'); // Unchanged
    });

    it('should update state and return new instance', () => {
      const updated = learner.withState('active');

      expect(updated).not.toBe(learner);
      expect(learner.state).toBe('onboarding');
      expect(updated.state).toBe('active');
    });

    it('should update profile and return new instance', () => {
      const updated = learner.withProfile({
        completedMissionsCount: 5,
        totalHoursLearned: 10,
      });

      expect(updated).not.toBe(learner);
      expect(learner.profile.completedMissionsCount).toBe(0);
      expect(updated.profile.completedMissionsCount).toBe(5);
      expect(updated.profile.totalHoursLearned).toBe(10);
      expect(updated.profile.currentStreak).toBe(0); // Unchanged
    });

    it('should update lastActiveAt', () => {
      const now = new Date().toISOString();
      const updated = learner.withLastActiveAt(now);

      expect(updated).not.toBe(learner);
      expect(learner.profile.lastActiveAt).toBeUndefined();
      expect(updated.profile.lastActiveAt).toBe(now);
    });
  });

  describe('Validation', () => {
    it('should validate required fields', () => {
      const invalidLearner = new Learner({
        id: '',
        email: 'test@example.com',
        name: 'John',
        preferences: {
          learningStyle: 'visual',
          pacePreference: 'normal',
          availableHoursPerWeek: 10,
          preferredLanguage: 'en',
          timezone: 'UTC',
          topicsOfInterest: [],
          careersOfInterest: [],
        },
        profile: {
          onboardedAt: new Date().toISOString(),
          totalHoursLearned: 0,
          completedMissionsCount: 0,
          currentStreak: 0,
          longestStreak: 0,
        },
        state: 'onboarding',
        tenantId: 'tenant-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(() => invalidLearner.validate()).toThrow('Learner id is required');
    });

    it('should validate email format', () => {
      const invalidLearner = new Learner({
        id: 'learner-123',
        email: 'invalid-email',
        name: 'John',
        preferences: {
          learningStyle: 'visual',
          pacePreference: 'normal',
          availableHoursPerWeek: 10,
          preferredLanguage: 'en',
          timezone: 'UTC',
          topicsOfInterest: [],
          careersOfInterest: [],
        },
        profile: {
          onboardedAt: new Date().toISOString(),
          totalHoursLearned: 0,
          completedMissionsCount: 0,
          currentStreak: 0,
          longestStreak: 0,
        },
        state: 'onboarding',
        tenantId: 'tenant-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(() => invalidLearner.validate()).toThrow('Valid email is required');
    });

    it('should validate streak invariant', () => {
      const invalidLearner = new Learner({
        id: 'learner-123',
        email: 'test@example.com',
        name: 'John',
        preferences: {
          learningStyle: 'visual',
          pacePreference: 'normal',
          availableHoursPerWeek: 10,
          preferredLanguage: 'en',
          timezone: 'UTC',
          topicsOfInterest: [],
          careersOfInterest: [],
        },
        profile: {
          onboardedAt: new Date().toISOString(),
          totalHoursLearned: 0,
          completedMissionsCount: 0,
          currentStreak: 10,
          longestStreak: 5, // Invalid: current > longest
        },
        state: 'onboarding',
        tenantId: 'tenant-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(() => invalidLearner.validate()).toThrow(
        'Longest streak cannot be less than current streak'
      );
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON', () => {
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

      const json = learner.toJSON();

      expect(json.id).toBe(learner.id);
      expect(json.email).toBe('test@example.com');
      expect(json.name).toBe('John Doe');
      expect(json.state).toBe('onboarding');
      expect(typeof json.createdAt).toBe('string');
    });
  });
});
