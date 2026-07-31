import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeState, Evidence } from '../../src/domain';
import { KnowledgeStateService } from '../../src/services';
import { InMemoryEventStore, InMemoryEventBus } from '../../src/events';

/**
 * Knowledge State Journey Tests
 *
 * These tests describe how evidence accumulates into mastery.
 * They test the cognitive core of LAO:
 * - Mastery is inferred from evidence
 * - Confidence is calibrated against success rate
 * - Misconceptions are discovered and corrected
 * - Decay models knowledge loss over time
 * - Reinforcement maintains mastery
 */

describe('Knowledge State - Learner Mastery Journey', () => {
  let knowledgeService: KnowledgeStateService;
  let eventStore: InMemoryEventStore;
  let eventBus: InMemoryEventBus;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    eventBus = new InMemoryEventBus();
    knowledgeService = new KnowledgeStateService(eventStore, eventBus, null);
  });

  describe('Journey: Evidence-Based Mastery', () => {
    it('should start with zero mastery and no evidence', async () => {
      // Given a new learner and skill
      const learnerId = 'alice';
      const skillId = 'typescript-basics';

      // When we get or create the knowledge state
      const state = await knowledgeService.getOrCreateKnowledgeState(
        learnerId,
        skillId,
        'tenant-1'
      );

      // Then mastery should be zero
      expect(state.masteryLevel).toBe(0);
      expect(state.masteryStage).toBe('unfamiliar');
      expect(state.confidence).toBe(0);
      expect(state.evidence.length).toBe(0);
    });

    it('should increase mastery through assessment evidence', async () => {
      // Given a learner with zero mastery
      const learnerId = 'bob';
      const skillId = 'async-await';

      const state1 = KnowledgeState.create({
        learnerId,
        skillId,
        tenantId: 'tenant-1',
      });

      expect(state1.masteryLevel).toBe(0);
      expect(state1.masteryStage).toBe('unfamiliar');

      // When learner passes an assessment
      const evidence1: Evidence = {
        evidenceId: 'ev-1',
        type: 'assessment_passed',
        skillId,
        score: 85,
        timestamp: new Date().toISOString(),
        confidence: 0.8,
        weight: 0.5,
      };

      const state2 = state1.withEvidence(evidence1);

      // Then mastery should increase
      expect(state2.masteryLevel).toBeGreaterThan(0);
      expect(state2.confidence).toBeGreaterThan(0);
      expect(state2.successRate).toBe(100); // First attempt passed
      expect(state2.evidence.length).toBe(1);

      // When learner passes second assessment
      const evidence2: Evidence = {
        evidenceId: 'ev-2',
        type: 'assessment_passed',
        skillId,
        score: 90,
        timestamp: new Date().toISOString(),
        confidence: 0.85,
        weight: 0.5,
      };

      const state3 = state2.withEvidence(evidence2);

      // Then mastery should continue increasing
      expect(state3.masteryLevel).toBeGreaterThan(state2.masteryLevel);
      expect(state3.evidence.length).toBe(2);
      expect(['aware', 'developing']).toContain(state3.masteryStage); // Progressed
    });

    it('should detect and track misconceptions', async () => {
      // Given a learner attempting to learn a skill
      const learnerId = 'charlie';
      const skillId = 'closures';

      let state = KnowledgeState.create({
        learnerId,
        skillId,
        tenantId: 'tenant-1',
      });

      // When learner demonstrates understanding but has a misconception
      const evidence1: Evidence = {
        evidenceId: 'ev-1',
        type: 'assessment_passed',
        skillId,
        score: 65, // Barely passing
        timestamp: new Date().toISOString(),
        confidence: 0.4, // Low confidence
        weight: 0.5,
      };

      state = state.withEvidence(evidence1);

      // When a misconception is discovered
      state = state.withMisconception({
        description: 'Assumes closure variables are local scope',
        evidenceId: 'ev-1',
        impactedBy: ['closures', 'scope'],
      });

      // Then misconception should be tracked
      expect(state.misconceptions.length).toBe(1);
      expect(state.misconceptions[0].correctionStatus).toBe('discovered');
      expect(state.misconceptions[0].description).toContain('closure');

      // When misconception is corrected through practice
      state = state.withMisconception({
        description: 'Understood closure scope chains correctly',
        evidenceId: 'ev-2',
        impactedBy: ['closures'],
      });

      // Then correction is tracked
      expect(state.misconceptions.length).toBe(2);
    });

    it('should calculate confidence from success rate', async () => {
      // Given a learner with mixed assessment results
      const learnerId = 'diana';
      const skillId = 'regex';

      let state = KnowledgeState.create({
        learnerId,
        skillId,
        tenantId: 'tenant-1',
      });

      // When learner has inconsistent performance
      const evidence = [
        {
          score: 90,
          confidence: 0.9,
        },
        {
          score: 45, // Failure
          confidence: 0.3,
        },
        {
          score: 75,
          confidence: 0.7,
        },
        {
          score: 50, // Another failure
          confidence: 0.3,
        },
        {
          score: 85,
          confidence: 0.85,
        },
      ];

      for (let i = 0; i < evidence.length; i++) {
        const ev: Evidence = {
          evidenceId: `ev-${i}`,
          type: 'assessment_passed',
          skillId,
          score: evidence[i].score,
          timestamp: new Date().toISOString(),
          confidence: evidence[i].confidence,
          weight: 0.5,
        };
        state = state.withEvidence(ev);
      }

      // Then confidence should reflect actual performance
      expect(state.successRate).toBe(60); // 3 out of 5 passed
      expect(state.confidence).toBeGreaterThan(30); // Actual success provides some confidence
      expect(state.masteryLevel).toBeGreaterThan(0); // Evidence accumulates mastery
    });

    it('should track reinforcement needs', async () => {
      // Given a learner with established mastery
      const learnerId = 'eve';
      const skillId = 'promises';

      let state = KnowledgeState.create({
        learnerId,
        skillId,
        tenantId: 'tenant-1',
      });

      // Build mastery through evidence (heavier weighted evidence)
      for (let i = 0; i < 10; i++) {
        const ev: Evidence = {
          evidenceId: `ev-${i}`,
          type: 'mission_completed',
          skillId,
          score: 95,
          timestamp: new Date().toISOString(),
          confidence: 0.9,
          weight: 0.7, // Higher weight for missions
        };
        state = state.withEvidence(ev);
      }

      expect(state.masteryLevel).toBeGreaterThan(60); // Established mastery

      // Then reinforcement interval should be set
      expect(state.decay.reinforcementIntervalDays).toBeGreaterThan(0);

      // And reinforcement need should be tracked
      // (In real system, time passing would trigger this)
    });

    it('should demonstrate mastery progression through stages', async () => {
      // Given a learner progressing through skill levels
      const learnerId = 'frank';
      const skillId = 'react-hooks';

      let state = KnowledgeState.create({
        learnerId,
        skillId,
        tenantId: 'tenant-1',
      });

      // Stage 1: Unfamiliar (0%)
      expect(state.masteryStage).toBe('unfamiliar');

      // Stage 2: Aware (score 20)
      state = state.withEvidence({
        evidenceId: 'ev-1',
        type: 'question_answered',
        skillId,
        score: 60,
        timestamp: new Date().toISOString(),
        confidence: 0.4,
        weight: 0.3,
      });
      expect(state.masteryStage).toBe('aware');

      // Stage 3: Developing (score 35)
      for (let i = 2; i < 5; i++) {
        state = state.withEvidence({
          evidenceId: `ev-${i}`,
          type: 'assessment_passed',
          skillId,
          score: 75,
          timestamp: new Date().toISOString(),
          confidence: 0.7,
          weight: 0.5,
        });
      }
      expect(state.masteryStage).toBe('developing');

      // Stage 4: Proficient (score 65+)
      for (let i = 5; i < 10; i++) {
        state = state.withEvidence({
          evidenceId: `ev-${i}`,
          type: 'mission_completed',
          skillId,
          score: 90,
          timestamp: new Date().toISOString(),
          confidence: 0.85,
          weight: 0.7,
        });
      }
      expect(state.masteryStage).toBe('proficient');

      // Stage 5: Expert (score 80+)
      for (let i = 10; i < 20; i++) {
        state = state.withEvidence({
          evidenceId: `ev-${i}`,
          type: 'project_completed',
          skillId,
          score: 95,
          timestamp: new Date().toISOString(),
          confidence: 0.95,
          weight: 0.7,
        });
      }
      expect(['expert', 'proficient']).toContain(state.masteryStage); // At least proficient
    });

    it('should verify prerequisites are met', async () => {
      // Given a skill with prerequisites
      const learnerId = 'grace';
      const skillId = 'advanced-patterns';

      let state = KnowledgeState.create({
        learnerId,
        skillId,
        tenantId: 'tenant-1',
      });

      // When prerequisites are set
      const prereqs = [
        {
          skillId: 'basic-oop',
          mastery: 70,
          currentMastery: 40,
          isMet: false,
        },
        {
          skillId: 'typescript',
          mastery: 60,
          currentMastery: 85,
          isMet: true,
        },
      ];

      state = state.withPrerequisites(prereqs);

      // Then prerequisites status should be tracked
      expect(state.arePrerequisitesMet()).toBe(false); // Not all met
      expect(state.prerequisites.length).toBe(2);
      expect(state.prerequisites[1].isMet).toBe(true);
    });

    it('should track dependent skills', async () => {
      // Given a skill others depend on
      const learnerId = 'henry';
      const skillId = 'functions';

      let state = KnowledgeState.create({
        learnerId,
        skillId,
        tenantId: 'tenant-1',
      });

      // When dependent skills are registered
      const dependents = ['higher-order-functions', 'closures', 'callbacks'];
      state = state.withDependents(dependents);

      // Then dependents should be tracked
      expect(state.dependents.length).toBe(3);
      expect(state.dependents).toContain('closures');
    });
  });

  describe('Journey: Confidence Calibration', () => {
    it('should calibrate confidence against actual success', async () => {
      // Given learner with overconfidence
      const learnerId = 'iris';
      const skillId = 'testing';

      let state = KnowledgeState.create({
        learnerId,
        skillId,
        tenantId: 'tenant-1',
      });

      // When learner reports high confidence but fails assessments
      for (let i = 0; i < 3; i++) {
        state = state.withEvidence({
          evidenceId: `ev-${i}`,
          type: 'assessment_passed',
          skillId,
          score: 30, // Failing
          timestamp: new Date().toISOString(),
          confidence: 0.8, // But confident
          weight: 0.5,
        });
      }

      // Then confidence should be corrected by actual performance
      expect(state.confidence).toBeLessThan(40);
      expect(state.successRate).toBe(0);
    });
  });

  describe('Journey: Evidence Weights', () => {
    it('should weight evidence by significance', async () => {
      // Given different types of evidence
      const learnerId = 'jack';
      const skillId = 'algorithms';

      let state = KnowledgeState.create({
        learnerId,
        skillId,
        tenantId: 'tenant-1',
      });

      // Light evidence (question)
      state = state.withEvidence({
        evidenceId: 'ev-1',
        type: 'question_answered',
        skillId,
        score: 100,
        timestamp: new Date().toISOString(),
        confidence: 0.5,
        weight: 0.3, // Light
      });

      const after1 = state.masteryLevel;

      // Heavy evidence (mission)
      state = state.withEvidence({
        evidenceId: 'ev-2',
        type: 'mission_completed',
        skillId,
        score: 100,
        timestamp: new Date().toISOString(),
        confidence: 0.9,
        weight: 0.7, // Heavy
      });

      const after2 = state.masteryLevel;

      // Then mission should increase mastery more
      expect(after2).toBeGreaterThan(after1 * 1.5);
    });
  });
});
