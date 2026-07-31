import { KnowledgeState, Evidence } from '../domain';
import { DomainEvent, DomainEventBuilder, IEventStore, IEventBus } from '../events';
import { IService } from './ServiceInterfaces';
import { createUUID, now } from '../shared';
import {
  RecordAssessmentCommand,
  RecordMissionCompletionCommand,
  DiscoverMisconceptionCommand,
  RecordQuestionCommand,
  TriggerReinforcementCommand,
  UpdateKnowledgeGraphCommand,
  UpdateLearnerMemoryCommand,
  SetPrerequisitesCommand,
} from './commands/KnowledgeCommands';

/**
 * KnowledgeStateService is the cognitive core of LAO.
 *
 * Core principle: Mastery is evidence-based.
 * Every learner interaction produces evidence.
 * Evidence drives mastery calculations.
 * Mastery drives recommendations.
 *
 * This service never awards knowledge.
 * It only records evidence and infers mastery from that evidence.
 *
 * Commands:
 * - RecordAssessment → [SkillAssessed, MasteryIncreased|MasteryDecayed]
 * - RecordMissionCompletion → [MissionCompletedWithSkills, MasteryIncreased]
 * - DiscoverMisconception → [MisconceptionDiscovered]
 * - RecordQuestion → [QuestionAnswered, MasteryIncreased|MisconceptionDiscovered]
 * - TriggerReinforcement → [ReinforcementNeeded]
 *
 * Read models:
 * - Learner's skill mastery profile
 * - Knowledge graph with relationships
 * - Reinforcement schedule
 * - Misconception tracking
 * - Prerequisite satisfaction
 */
export class KnowledgeStateService implements IService {
  private cache = new Map<string, KnowledgeState>();
  private skillsByLearner = new Map<string, Map<string, KnowledgeState>>();

  constructor(
    private eventStore: IEventStore,
    private eventBus: IEventBus,
    private knowledgeRepository: any // Placeholder for repository
  ) {}

  async health(): Promise<boolean> {
    try {
      await this.eventStore.health();
      await this.eventBus.health();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get or create KnowledgeState for a learner-skill pair.
   */
  async getOrCreateKnowledgeState(
    learnerId: string,
    skillId: string,
    tenantId: string
  ): Promise<KnowledgeState> {
    const key = `${learnerId}:${skillId}`;

    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    // Try to find in repository
    let state = await this.knowledgeRepository?.findByLearnerAndSkill(learnerId, skillId);

    if (state) {
      this.cache.set(key, state);
      return state;
    }

    // Reconstruct from events
    state = await this.reconstructFromEvents(learnerId, skillId);
    if (!state) {
      // Create new if doesn't exist
      state = KnowledgeState.create({
        learnerId,
        skillId,
        tenantId,
      });
    }

    this.cache.set(key, state);
    return state;
  }

  /**
   * Record an assessment result.
   * This is evidence of skill mastery (or lack thereof).
   */
  async recordAssessment(command: RecordAssessmentCommand): Promise<KnowledgeState> {
    const state = await this.getOrCreateKnowledgeState(
      command.learnerId,
      command.skillId,
      command.tenantId
    );

    const timestamp = now();

    // Create evidence from assessment
    const evidence: Evidence = {
      evidenceId: createUUID(),
      type: 'assessment_passed',
      skillId: command.skillId,
      score: command.score,
      timestamp,
      confidence: command.score >= command.passThreshold ? 0.8 : 0.3,
      weight: 0.5, // Assessments are significant evidence
    };

    // Update knowledge state with new evidence
    const updated = state.withEvidence(evidence);

    // Persist events
    const event = new DomainEventBuilder('SkillAssessed', state.id, 'KnowledgeState')
      .setTenantId(command.tenantId)
      .setData({
        knowledgeStateId: state.id,
        learnerId: command.learnerId,
        skillId: command.skillId,
        assessmentId: command.assessmentId,
        score: command.score,
        maxScore: command.maxScore,
        passed: command.score >= command.passThreshold,
        timeSpentSeconds: command.timeSpentSeconds,
        attemptNumber: command.attemptNumber,
        newMasteryLevel: updated.masteryLevel,
        newConfidence: updated.confidence,
        timestamp,
      })
      .setVersion(1)
      .build();

    await this.eventStore.append(event);
    this.cache.set(`${command.learnerId}:${command.skillId}`, updated);
    await this.eventBus.publish(event);

    return updated;
  }

  /**
   * Record skills gained from mission completion.
   */
  async recordMissionCompletion(command: RecordMissionCompletionCommand): Promise<void> {
    const timestamp = now();

    for (const skillGain of command.skillsAcquired) {
      const state = await this.getOrCreateKnowledgeState(
        command.learnerId,
        skillGain.skillId,
        command.tenantId
      );

      const evidence: Evidence = {
        evidenceId: createUUID(),
        type: 'mission_completed',
        skillId: skillGain.skillId,
        score: command.qualityScore,
        timestamp,
        confidence: skillGain.confidence,
        weight: 0.7, // Missions demonstrate skill application
      };

      const updated = state.withEvidence(evidence);

      const event = new DomainEventBuilder('MissionCompletedWithSkills', state.id, 'KnowledgeState')
        .setTenantId(command.tenantId)
        .setData({
          knowledgeStateId: state.id,
          learnerId: command.learnerId,
          missionId: command.missionId,
          skillId: skillGain.skillId,
          masteryBoost: skillGain.masteryBoost,
          qualityScore: command.qualityScore,
          newMasteryLevel: updated.masteryLevel,
          timestamp,
        })
        .setVersion(1)
        .build();

      await this.eventStore.append(event);
      this.cache.set(`${command.learnerId}:${skillGain.skillId}`, updated);
      await this.eventBus.publish(event);
    }
  }

  /**
   * Discover and record a misconception.
   */
  async discoverMisconception(command: DiscoverMisconceptionCommand): Promise<KnowledgeState> {
    const state = await this.getOrCreateKnowledgeState(
      command.learnerId,
      command.skillId,
      command.tenantId
    );

    const timestamp = now();
    const updated = state.withMisconception({
      description: command.misconceptionDescription,
      evidenceId: command.discoveredViaAssessmentId || '',
      impactedBy: command.impactedSkills,
    });

    const event = new DomainEventBuilder('MisconceptionDiscovered', state.id, 'KnowledgeState')
      .setTenantId(command.tenantId)
      .setData({
        knowledgeStateId: state.id,
        learnerId: command.learnerId,
        skillId: command.skillId,
        misconceptionDescription: command.misconceptionDescription,
        severity: command.severity,
        impactedSkills: command.impactedSkills,
        timestamp,
      })
      .setVersion(1)
      .build();

    await this.eventStore.append(event);
    this.cache.set(`${command.learnerId}:${command.skillId}`, updated);
    await this.eventBus.publish(event);

    return updated;
  }

  /**
   * Record that learner answered a question.
   */
  async recordQuestion(command: RecordQuestionCommand): Promise<KnowledgeState> {
    const state = await this.getOrCreateKnowledgeState(
      command.learnerId,
      command.skillId,
      command.tenantId
    );

    const timestamp = now();

    const evidence: Evidence = {
      evidenceId: createUUID(),
      type: 'question_answered',
      skillId: command.skillId,
      score: command.correct ? 100 : 0,
      timestamp,
      confidence: command.confidence,
      weight: 0.3, // Questions are lighter evidence than assessments
    };

    const updated = state.withEvidence(evidence);

    const event = new DomainEventBuilder('QuestionAnswered', state.id, 'KnowledgeState')
      .setTenantId(command.tenantId)
      .setData({
        knowledgeStateId: state.id,
        learnerId: command.learnerId,
        skillId: command.skillId,
        questionId: command.questionId,
        correct: command.correct,
        hintUsed: command.hintUsed,
        timeSpentSeconds: command.timeSpentSeconds,
        confidence: command.confidence,
        timestamp,
      })
      .setVersion(1)
      .build();

    await this.eventStore.append(event);
    this.cache.set(`${command.learnerId}:${command.skillId}`, updated);
    await this.eventBus.publish(event);

    return updated;
  }

  /**
   * Trigger reinforcement reminder for a skill.
   */
  async triggerReinforcement(command: TriggerReinforcementCommand): Promise<void> {
    const state = await this.getOrCreateKnowledgeState(
      command.learnerId,
      command.skillId,
      command.tenantId
    );

    if (!state.needsReinforcement()) {
      return; // No reinforcement needed
    }

    const timestamp = now();
    const daysSinceLast = state.decay.lastPractised
      ? Math.floor(
          (new Date(timestamp).getTime() - new Date(state.decay.lastPractised).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

    const event = new DomainEventBuilder('ReinforcementNeeded', state.id, 'KnowledgeState')
      .setTenantId(command.tenantId)
      .setData({
        knowledgeStateId: state.id,
        learnerId: command.learnerId,
        skillId: command.skillId,
        daysSinceLast,
        currentMastery: state.masteryLevel,
        reason: command.reason,
        suggestedPracticeType: this.suggestPracticeType(state),
        timestamp,
      })
      .setVersion(1)
      .build();

    await this.eventStore.append(event);
    await this.eventBus.publish(event);
  }

  /**
   * Update knowledge graph relationships.
   */
  async updateKnowledgeGraph(command: UpdateKnowledgeGraphCommand): Promise<void> {
    const state = await this.getOrCreateKnowledgeState(
      command.learnerId,
      command.skillId,
      command.tenantId
    );

    const timestamp = now();

    const event = new DomainEventBuilder('SkillKnowledgeGraphUpdated', state.id, 'KnowledgeState')
      .setTenantId(command.tenantId)
      .setData({
        knowledgeStateId: state.id,
        learnerId: command.learnerId,
        skillId: command.skillId,
        relationships: command.relationships,
        timestamp,
      })
      .setVersion(1)
      .build();

    await this.eventStore.append(event);
    await this.eventBus.publish(event);
  }

  /**
   * Update learner memory based on patterns.
   */
  async updateLearnerMemory(command: UpdateLearnerMemoryCommand): Promise<void> {
    const timestamp = now();

    const event = new DomainEventBuilder('LearnerMemoryUpdated', command.learnerId, 'Learner')
      .setTenantId(command.tenantId)
      .setData({
        learnerId: command.learnerId,
        preferredExplanationStyle: command.preferredExplanationStyle,
        preferredPace: command.preferredPace,
        identifiedStrengths: command.identifiedStrengths,
        identifiedWeaknesses: command.identifiedWeaknesses,
        avoidedSubjects: command.avoidedSubjects,
        enjoyedSubjects: command.enjoyedSubjects,
        successfulStrategies: command.successfulStrategies,
        timestamp,
      })
      .setVersion(1)
      .build();

    await this.eventStore.append(event);
    await this.eventBus.publish(event);
  }

  /**
   * Get all knowledge states for a learner.
   */
  async getLearnersKnowledgeStates(learnerId: string): Promise<KnowledgeState[]> {
    let states = this.skillsByLearner.get(learnerId);
    if (states) {
      return Array.from(states.values());
    }

    // Load from repository
    const loaded = await this.knowledgeRepository?.findByLearnerId(learnerId);
    if (loaded) {
      states = new Map(loaded.map((s: KnowledgeState) => [s.skillId, s]));
      this.skillsByLearner.set(learnerId, states);
      return loaded;
    }

    return [];
  }

  /**
   * Reconstruct KnowledgeState from events.
   */
  private async reconstructFromEvents(learnerId: string, skillId: string): Promise<KnowledgeState | null> {
    const events = await this.eventStore.query({
      aggregateType: 'KnowledgeState',
      eventType: 'SkillAssessed',
    });

    if (events.length === 0) {
      return null;
    }

    // Find initialization event
    let state = KnowledgeState.create({
      learnerId,
      skillId,
      tenantId: 'tenant-default',
    });

    // Replay events to reconstruct state
    for (const event of events) {
      const data = event.data as Record<string, unknown>;
      if (data.learnerId === learnerId && data.skillId === skillId) {
        // Replay evidence
        const evidence: Evidence = {
          evidenceId: data.evidenceId as string,
          type: 'assessment_passed',
          skillId,
          score: (data.score as number) || 0,
          timestamp: event.timestamp,
          confidence: (data.confidence as number) || 0.5,
          weight: 0.5,
        };
        state = state.withEvidence(evidence);
      }
    }

    return state;
  }

  /**
   * Suggest appropriate practice type based on skill state.
   */
  private suggestPracticeType(state: KnowledgeState): string {
    if (state.misconceptions.some((m) => m.correctionStatus === 'discovered')) {
      return 'reflection'; // Address misconceptions first
    }
    if (state.successRate < 70) {
      return 'practice'; // Need more practice
    }
    if (state.masteryLevel < 50) {
      return 'assessment'; // Check progress
    }
    return 'project'; // Apply to real-world context
  }

  /**
   * Handle events from other services.
   */
  async handleEvent(event: DomainEvent): Promise<void> {
    // KnowledgeState responds to:
    // - MissionCompleted: update skill mastery
    // - AssessmentCompleted: record evidence
    // - GoalCreated: initialize prerequisite tracking
    if (event.eventType === 'MissionCompleted') {
      // Handle mission completion effect on knowledge
    }
  }
}
