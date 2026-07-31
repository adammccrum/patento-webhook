import { describe, it, expect, beforeEach } from 'vitest';
import { LearnerService } from '../../src/services/LearnerService';
import { GoalService } from '../../src/services/GoalService';
import { ProgressService } from '../../src/services/ProgressService';
import {
  InMemoryEventStore,
  InMemoryEventBus,
  MockEventStore,
  MockEventBus,
} from '../../src/events';
import { MockRepositoryFactory } from '../../src/repository';

/**
 * Behavior-driven tests describing real learner journeys.
 * These tests focus on complete workflows, not isolated methods.
 *
 * Test philosophy:
 * - Each test is a complete scenario
 * - Read like business stories
 * - Verify end-to-end behavior
 * - All state flows through events
 */

describe('Learner Journey - Complete Workflows', () => {
  let eventStore: InMemoryEventStore;
  let eventBus: InMemoryEventBus;
  let repositoryFactory: MockRepositoryFactory;
  let learnerService: LearnerService;
  let goalService: GoalService;
  let progressService: ProgressService;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    eventBus = new InMemoryEventBus();
    repositoryFactory = new MockRepositoryFactory();

    learnerService = new LearnerService(
      eventStore,
      eventBus,
      repositoryFactory.getLearnerRepository()
    );

    goalService = new GoalService(eventStore, eventBus, repositoryFactory.getGoalRepository());

    progressService = new ProgressService(
      eventStore,
      eventBus,
      repositoryFactory.getMissionProgressRepository()
    );
  });

  describe('Journey: Learner Registration and Onboarding', () => {
    it('should register learner and produce UserOnboarded event', async () => {
      // When a new learner registers
      const learner = await learnerService.registerLearner({
        email: 'alice@example.com',
        name: 'Alice Chen',
        preferences: {
          learningStyle: 'visual',
          pacePreference: 'fast',
          availableHoursPerWeek: 15,
          preferredLanguage: 'en',
          timezone: 'America/New_York',
          topicsOfInterest: ['AI', 'Machine Learning'],
          careersOfInterest: ['Data Scientist'],
        },
        tenantId: 'tenant-1',
      });

      // Then learner should exist with correct details
      expect(learner).toBeDefined();
      expect(learner.email).toBe('alice@example.com');
      expect(learner.name).toBe('Alice Chen');
      expect(learner.preferences.learningStyle).toBe('visual');

      // And events should be persisted
      const events = await eventStore.getEventsByAggregateId(learner.id);
      expect(events.length).toBe(2); // LearnerRegistered + UserOnboarded
      expect(events.some((e) => e.eventType === 'LearnerRegistered')).toBe(true);
      expect(events.some((e) => e.eventType === 'UserOnboarded')).toBe(true);

      // And learner should be retrievable
      const retrieved = await learnerService.getLearner(learner.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.email).toBe('alice@example.com');

      // And by email
      const byEmail = await learnerService.getLearnerByEmail('alice@example.com');
      expect(byEmail).not.toBeNull();
      expect(byEmail?.id).toBe(learner.id);
    });
  });

  describe('Journey: Learner Creates and Pursues Goals', () => {
    it('should create multiple goals and track progress independently', async () => {
      // Setup: Register learner
      const learner = await learnerService.registerLearner({
        email: 'bob@example.com',
        name: 'Bob Smith',
        preferences: {
          learningStyle: 'auditory',
          pacePreference: 'normal',
          availableHoursPerWeek: 10,
          preferredLanguage: 'en',
          timezone: 'UTC',
          topicsOfInterest: [],
          careersOfInterest: [],
        },
        tenantId: 'tenant-1',
      });

      // When learner creates first goal
      const goal1 = await goalService.createGoal({
        learnerId: learner.id,
        title: 'Learn Python',
        description: 'Become proficient in Python programming',
        goalType: 'skill',
        category: 'Programming',
        targetValue: 3,
        targetUnit: 'projects',
        priority: 5,
        tenantId: 'tenant-1',
      });

      // And second goal
      const goal2 = await goalService.createGoal({
        learnerId: learner.id,
        title: 'Get AWS Certification',
        description: 'Earn AWS Solutions Architect certification',
        goalType: 'certification',
        category: 'Cloud',
        targetValue: 1,
        targetUnit: 'certification',
        deadline: '2026-12-31',
        priority: 4,
        tenantId: 'tenant-1',
      });

      // Then both goals should exist
      const goals = await goalService.getGoalsByLearner(learner.id);
      expect(goals).toHaveLength(2);
      expect(goals.map((g) => g.title)).toContain('Learn Python');
      expect(goals.map((g) => g.title)).toContain('Get AWS Certification');

      // And both should be in draft status
      expect(goal1.status).toBe('draft');
      expect(goal2.status).toBe('draft');

      // And both should emit events
      const goal1Events = await eventStore.getEventsByAggregateId(goal1.id);
      const goal2Events = await eventStore.getEventsByAggregateId(goal2.id);
      expect(goal1Events.length).toBeGreaterThan(0);
      expect(goal2Events.length).toBeGreaterThan(0);
    });

    it('should activate goal and update progress to 100% and complete', async () => {
      // Setup: Register learner and create goal
      const learner = await learnerService.registerLearner({
        email: 'carol@example.com',
        name: 'Carol Jones',
        preferences: {
          learningStyle: 'kinesthetic',
          pacePreference: 'fast',
          availableHoursPerWeek: 20,
          preferredLanguage: 'en',
          timezone: 'UTC',
          topicsOfInterest: [],
          careersOfInterest: [],
        },
        tenantId: 'tenant-1',
      });

      const goal = await goalService.createGoal({
        learnerId: learner.id,
        title: 'Complete JavaScript Course',
        description: 'Master JavaScript fundamentals',
        goalType: 'skill',
        category: 'Programming',
        targetValue: 1,
        targetUnit: 'course',
        tenantId: 'tenant-1',
      });

      // When learner activates goal
      const activated = await goalService.activateGoal(goal.id);

      // Then status should be active
      expect(activated.status).toBe('active');

      // And progress should be updatable
      const halfway = await goalService.updateProgress(goal.id, 50);
      expect(halfway.progressPercentage).toBe(50);

      // And further progress
      const almost = await goalService.updateProgress(goal.id, 90);
      expect(almost.progressPercentage).toBe(90);

      // When progress reaches 100%
      const complete = await goalService.updateProgress(goal.id, 100);
      expect(complete.progressPercentage).toBe(100);

      // And goal is marked achieved
      const achieved = await goalService.markAchieved(goal.id);
      expect(achieved.status).toBe('achieved');

      // Then event stream should show full lifecycle
      const events = await eventStore.getEventsByAggregateId(goal.id);
      expect(events.some((e) => e.eventType === 'GoalCreated')).toBe(true);
      expect(events.some((e) => e.eventType === 'GoalActivated')).toBe(true);
      expect(events.some((e) => e.eventType === 'GoalProgressUpdated')).toBe(true);
      expect(events.some((e) => e.eventType === 'GoalCompleted')).toBe(true);
    });

    it('should pause and resume goal', async () => {
      const learner = await learnerService.registerLearner({
        email: 'dave@example.com',
        name: 'Dave Wilson',
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

      const goal = await goalService.createGoal({
        learnerId: learner.id,
        title: 'Learn Data Analysis',
        description: 'Master data analysis skills',
        goalType: 'skill',
        category: 'Data',
        targetValue: 1,
        targetUnit: 'skill',
        tenantId: 'tenant-1',
      });

      // Activate goal
      await goalService.activateGoal(goal.id);

      // Update progress
      await goalService.updateProgress(goal.id, 25);

      // When learner pauses goal
      const paused = await goalService.pauseGoal(goal.id, 'Focusing on other priorities');

      // Then status should be paused
      expect(paused.status).toBe('paused');

      // And can be resumed by activating again
      const activated = await goalService.activateGoal(paused.id);
      expect(activated.status).toBe('active');

      // And can be completed after reaching 100%
      await goalService.updateProgress(activated.id, 100);
      const completed = await goalService.markAchieved(activated.id);
      expect(completed.status).toBe('achieved');
    });
  });

  describe('Journey: Learner Updates Preferences', () => {
    it('should update preferences and emit event', async () => {
      const learner = await learnerService.registerLearner({
        email: 'eve@example.com',
        name: 'Eve Brown',
        preferences: {
          learningStyle: 'visual',
          pacePreference: 'slow',
          availableHoursPerWeek: 5,
          preferredLanguage: 'en',
          timezone: 'UTC',
          topicsOfInterest: [],
          careersOfInterest: [],
        },
        tenantId: 'tenant-1',
      });

      // Initial preference
      expect(learner.preferences.pacePreference).toBe('slow');
      expect(learner.preferences.availableHoursPerWeek).toBe(5);

      // When preferences updated
      const updated = await learnerService.updatePreferences(learner.id, {
        pacePreference: 'fast',
        availableHoursPerWeek: 20,
        topicsOfInterest: ['AI', 'ML', 'NLP'],
      });

      // Then new preferences should be applied
      expect(updated.preferences.pacePreference).toBe('fast');
      expect(updated.preferences.availableHoursPerWeek).toBe(20);
      expect(updated.preferences.topicsOfInterest).toContain('AI');

      // And event should be recorded
      const events = await eventStore.getEventsByAggregateId(learner.id);
      const prefsEvent = events.find((e) => e.eventType === 'LearnerPreferencesUpdated');
      expect(prefsEvent).toBeDefined();
    });
  });

  describe('Journey: Learner Records Activity', () => {
    it('should record learning sessions and update lastActiveAt', async () => {
      const learner = await learnerService.registerLearner({
        email: 'frank@example.com',
        name: 'Frank Miller',
        preferences: {
          learningStyle: 'reading',
          pacePreference: 'normal',
          availableHoursPerWeek: 12,
          preferredLanguage: 'en',
          timezone: 'UTC',
          topicsOfInterest: [],
          careersOfInterest: [],
        },
        tenantId: 'tenant-1',
      });

      // Initial state: no last active
      expect(learner.profile.lastActiveAt).toBeUndefined();

      // When learner records activity
      const active1 = await learnerService.recordActivity(learner.id);

      // Then lastActiveAt should be set
      expect(active1.profile.lastActiveAt).toBeDefined();
      const firstTime = active1.profile.lastActiveAt;

      // Wait a moment to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      // When recording another session
      const active2 = await learnerService.recordActivity(learner.id);

      // Then lastActiveAt should be updated
      expect(active2.profile.lastActiveAt).toBeDefined();
      expect(active2.profile.lastActiveAt).not.toBe(firstTime);

      // And events should be recorded
      const events = await eventStore.getEventsByAggregateId(learner.id);
      const sessionEvents = events.filter((e) => e.eventType === 'LearningSessionRecorded');
      expect(sessionEvents.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Journey: Complete Event Sourcing Reconstruction', () => {
    it('should reconstruct learner state from event history', async () => {
      // Setup: Create learner, update preferences, change state
      const learner = await learnerService.registerLearner({
        email: 'grace@example.com',
        name: 'Grace Lee',
        preferences: {
          learningStyle: 'visual',
          pacePreference: 'normal',
          availableHoursPerWeek: 10,
          preferredLanguage: 'en',
          timezone: 'UTC',
          topicsOfInterest: ['Python'],
          careersOfInterest: ['Backend Engineer'],
        },
        tenantId: 'tenant-1',
      });

      // Make several state changes
      await learnerService.updatePreferences(learner.id, {
        availableHoursPerWeek: 15,
      });

      await learnerService.updateState(learner.id, 'active');

      await learnerService.recordActivity(learner.id);

      // Clear cache to force reconstruction
      const learnerService2 = new LearnerService(
        eventStore,
        eventBus,
        repositoryFactory.getLearnerRepository()
      );

      // When reconstructing from events
      const reconstructed = await learnerService2.getLearner(learner.id);

      // Then all state should be correct
      expect(reconstructed).not.toBeNull();
      expect(reconstructed?.email).toBe('grace@example.com');
      expect(reconstructed?.name).toBe('Grace Lee');
      expect(reconstructed?.preferences.availableHoursPerWeek).toBe(15);
      expect(reconstructed?.state).toBe('active');
      expect(reconstructed?.profile.lastActiveAt).toBeDefined();

      // And all events should be present
      const events = await eventStore.getEventsByAggregateId(learner.id);
      expect(events.length).toBeGreaterThanOrEqual(4); // Register + 3 changes
    });
  });

  describe('Journey: Progress Tracking Through Missions', () => {
    it('should track mission progress from start to completion', async () => {
      const learner = await learnerService.registerLearner({
        email: 'henry@example.com',
        name: 'Henry Zhang',
        preferences: {
          learningStyle: 'kinesthetic',
          pacePreference: 'fast',
          availableHoursPerWeek: 20,
          preferredLanguage: 'en',
          timezone: 'UTC',
          topicsOfInterest: [],
          careersOfInterest: [],
        },
        tenantId: 'tenant-1',
      });

      const missionId = 'mission-python-101';
      const goalId = 'goal-1';

      // When learner starts mission
      const started = await progressService.startMission(learner.id, missionId);

      // Then progress should be in-progress
      expect(started.status).toBe('in-progress');
      expect(started.learnerId).toBe(learner.id);
      expect(started.missionId).toBe(missionId);

      // When learner completes mission with scores
      const completed = await progressService.completeMission(
        learner.id,
        missionId,
        85, // comprehension score
        2.5 // hours spent
      );

      // Then progress should show completion
      expect(completed.status).toBe('completed');

      // And summary should reflect completion
      const summary = await progressService.getSummary(learner.id);
      expect(summary.totalCompleted).toBeGreaterThan(0);
    });
  });
});
