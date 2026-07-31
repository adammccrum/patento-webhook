import { Goal } from '../domain';
import { DomainEvent, DomainEventBuilder, IEventStore, IEventBus } from '../events';
import { IGoalService } from './ServiceInterfaces';
import { IGoalRepository } from '../repository';
import { createUUID, now } from '../shared';
import {
  CreateGoalCommand,
  ActivateGoalCommand,
  PauseGoalCommand,
  CompleteGoalCommand,
  AbandonGoalCommand,
  UpdateGoalProgressCommand,
} from './commands/GoalCommands';

/**
 * GoalService owns goal definitions and progress tracking.
 *
 * Core principle: Goals are the heart of LAO.
 * Every mission, recommendation, and achievement ultimately relates to a goal.
 * Progress is measured against goals, not courses.
 *
 * Commands:
 * - CreateGoal → [GoalCreated]
 * - ActivateGoal → [GoalActivated]
 * - PauseGoal → [GoalPaused]
 * - UpdateGoalProgress → [GoalProgressUpdated]
 * - CompleteGoal → [GoalCompleted]
 * - AbandonGoal → [GoalAbandoned]
 *
 * Events trigger reactions:
 * - GoalCreated → [LearningPathGenerated, KnowledgeGapDetected]
 * - GoalCompleted → [AchievementUnlocked, CreditsAwarded]
 * - GoalProgressUpdated → [RecommendationEngineInvalidated]
 *
 * Read models:
 * - Learner's active goals
 * - Goal detail with progress
 * - Goal timeline
 * - Stalled goal detection
 */
export class GoalService implements IGoalService {
  private cache = new Map<string, Goal>();
  private eventIndex = new Map<string, DomainEvent[]>();

  constructor(
    private eventStore: IEventStore,
    private eventBus: IEventBus,
    private repository: IGoalRepository
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
   * Create a new goal.
   * Produces: GoalCreated
   * Triggers: LearningPathGenerated, KnowledgeGapDetected
   */
  async createGoal(data: {
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
  }): Promise<Goal> {
    const timestamp = now();

    // Create goal in draft state - this generates the ID
    const goal = Goal.create({
      learnerId: data.learnerId,
      title: data.title,
      description: data.description,
      goalType: data.goalType,
      category: data.category,
      targetValue: data.targetValue,
      targetUnit: data.targetUnit,
      priority: data.priority,
      tenantId: data.tenantId,
    });

    const goalId = goal.id; // Use the generated ID

    // Create event
    const event = new DomainEventBuilder('GoalCreated', goalId, 'Goal')
      .setTenantId(data.tenantId)
      .setData({
        goalId,
        learnerId: data.learnerId,
        title: data.title,
        description: data.description,
        goalType: data.goalType,
        category: data.category,
        targetValue: data.targetValue,
        targetUnit: data.targetUnit,
        deadline: data.deadline,
        priority: data.priority || 3,
        createdAt: timestamp,
      })
      .setVersion(1)
      .build();

    // Persist event
    await this.eventStore.append(event);

    // Save to repository as read model
    await this.repository.save(goal);

    // Cache
    this.cache.set(goalId, goal);

    // Publish (triggers downstream reactions)
    await this.eventBus.publish(event);

    return goal;
  }

  /**
   * Get goal by ID.
   * First checks cache, then reconstructs from events.
   */
  async getGoal(goalId: string): Promise<Goal | null> {
    // Check cache first
    if (this.cache.has(goalId)) {
      return this.cache.get(goalId)!;
    }

    // Try repository read model
    const goal = await this.repository.findById(goalId);
    if (goal) {
      this.cache.set(goalId, goal);
      return goal;
    }

    // Reconstruct from events
    const goal_reconstructed = await this.reconstructGoalFromEvents(goalId);
    if (goal_reconstructed) {
      this.cache.set(goalId, goal_reconstructed);
      return goal_reconstructed;
    }

    return null;
  }

  /**
   * Get all goals for a learner.
   */
  async getGoalsByLearner(learnerId: string): Promise<Goal[]> {
    return this.repository.findByLearnerId(learnerId);
  }

  /**
   * Activate a goal (transition draft → active).
   * Produces: GoalActivated
   */
  async activateGoal(goalId: string): Promise<Goal> {
    const goal = await this.getGoal(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    if (!goal.canTransitionTo('active')) {
      throw new Error(`Cannot transition goal from ${goal.status} to active`);
    }

    const timestamp = now();

    // Create event
    const event = new DomainEventBuilder('GoalActivated', goalId, 'Goal')
      .setTenantId(goal.tenantId)
      .setData({
        goalId,
        learnerId: goal.learnerId,
        status: 'active',
        activatedAt: timestamp,
      })
      .setVersion(1)
      .build();

    // Persist event
    await this.eventStore.append(event);

    // Update in-memory state
    const updated = goal.withStatus('active');
    this.cache.set(goalId, updated);
    await this.repository.save(updated);

    // Publish
    await this.eventBus.publish(event);

    return updated;
  }

  /**
   * Pause a goal (active → paused).
   * Produces: GoalPaused
   */
  async pauseGoal(goalId: string, reason?: string): Promise<Goal> {
    const goal = await this.getGoal(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    if (!goal.canTransitionTo('paused')) {
      throw new Error(`Cannot transition goal from ${goal.status} to paused`);
    }

    const timestamp = now();

    // Create event
    const event = new DomainEventBuilder('GoalPaused', goalId, 'Goal')
      .setTenantId(goal.tenantId)
      .setData({
        goalId,
        learnerId: goal.learnerId,
        status: 'paused',
        reason,
        pausedAt: timestamp,
      })
      .setVersion(1)
      .build();

    // Persist event
    await this.eventStore.append(event);

    // Update in-memory state
    const updated = goal.withStatus('paused');
    this.cache.set(goalId, updated);
    await this.repository.save(updated);

    // Publish
    await this.eventBus.publish(event);

    return updated;
  }

  /**
   * Update goal progress.
   * Produces: GoalProgressUpdated
   * Progress drives achievement detection and mission recommendations.
   */
  async updateProgress(goalId: string, progressPercentage: number): Promise<Goal> {
    const goal = await this.getGoal(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    const timestamp = now();

    // Create event
    const event = new DomainEventBuilder('GoalProgressUpdated', goalId, 'Goal')
      .setTenantId(goal.tenantId)
      .setData({
        goalId,
        learnerId: goal.learnerId,
        progressPercentage,
        updatedAt: timestamp,
      })
      .setVersion(1)
      .build();

    // Persist event
    await this.eventStore.append(event);

    // Update in-memory state
    const updated = goal.withProgress(progressPercentage);
    this.cache.set(goalId, updated);
    await this.repository.save(updated);

    // Publish (triggers recommendation engine invalidation)
    await this.eventBus.publish(event);

    return updated;
  }

  /**
   * Mark goal as achieved (progress must be 100%).
   * Produces: GoalCompleted
   * Triggers: AchievementUnlocked, CreditsAwarded
   */
  async markAchieved(goalId: string): Promise<Goal> {
    const goal = await this.getGoal(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    if (goal.progressPercentage < 100) {
      throw new Error(`Cannot achieve goal with less than 100% progress`);
    }

    if (!goal.canTransitionTo('achieved')) {
      throw new Error(`Cannot transition goal from ${goal.status} to achieved`);
    }

    const timestamp = now();

    // Create event
    const event = new DomainEventBuilder('GoalCompleted', goalId, 'Goal')
      .setTenantId(goal.tenantId)
      .setData({
        goalId,
        learnerId: goal.learnerId,
        status: 'achieved',
        progressPercentage: 100,
        completedAt: timestamp,
      })
      .setVersion(1)
      .build();

    // Persist event
    await this.eventStore.append(event);

    // Update in-memory state
    const updated = goal.withStatus('achieved', timestamp);
    this.cache.set(goalId, updated);
    await this.repository.save(updated);

    // Publish (triggers achievements and credits)
    await this.eventBus.publish(event);

    return updated;
  }

  /**
   * Abandon a goal.
   * Produces: GoalAbandoned
   */
  async markAbandoned(goalId: string, reason?: string): Promise<Goal> {
    const goal = await this.getGoal(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    if (!goal.canTransitionTo('abandoned')) {
      throw new Error(`Cannot transition goal from ${goal.status} to abandoned`);
    }

    const timestamp = now();

    // Create event
    const event = new DomainEventBuilder('GoalAbandoned', goalId, 'Goal')
      .setTenantId(goal.tenantId)
      .setData({
        goalId,
        learnerId: goal.learnerId,
        status: 'abandoned',
        reason,
        abandonedAt: timestamp,
      })
      .setVersion(1)
      .build();

    // Persist event
    await this.eventStore.append(event);

    // Update in-memory state
    const updated = goal.withStatus('abandoned');
    this.cache.set(goalId, updated);
    await this.repository.save(updated);

    // Publish
    await this.eventBus.publish(event);

    return updated;
  }

  /**
   * Reconstruct goal aggregate from event history.
   */
  private async reconstructGoalFromEvents(goalId: string): Promise<Goal | null> {
    const events = await this.eventStore.getEventsByAggregateId(goalId);

    if (events.length === 0) {
      return null;
    }

    // Find GoalCreated event to initialize
    const initEvent = events.find((e) => e.eventType === 'GoalCreated');

    if (!initEvent) {
      return null;
    }

    const data = initEvent.data as Record<string, unknown>;
    let goal = Goal.create({
      learnerId: data.learnerId as string,
      title: data.title as string,
      description: data.description as string,
      goalType: data.goalType as string,
      category: data.category as string,
      targetValue: data.targetValue as number,
      targetUnit: data.targetUnit as string,
      priority: (data.priority as number) || 3,
      tenantId: initEvent.tenantId,
    });

    // Replay remaining events
    for (const event of events) {
      if (event.eventType === 'GoalProgressUpdated') {
        const eventData = event.data as Record<string, unknown>;
        goal = goal.withProgress(eventData.progressPercentage as number);
      } else if (
        event.eventType === 'GoalActivated' ||
        event.eventType === 'GoalPaused' ||
        event.eventType === 'GoalCompleted' ||
        event.eventType === 'GoalAbandoned'
      ) {
        const eventData = event.data as Record<string, unknown>;
        const status = eventData.status as string;
        const completedAt =
          status === 'achieved' ? (eventData.completedAt as string) : undefined;
        goal = goal.withStatus(status, completedAt);
      }
    }

    return goal;
  }

  /**
   * Handle events from other services.
   * GoalService reacts to:
   * - MissionCompleted: update goal progress
   * - CompetencyUpdated: trigger skill-related goals
   */
  async handleEvent(event: DomainEvent): Promise<void> {
    // Mission completion updates goal progress
    if (event.eventType === 'MissionCompleted') {
      // In Phase 3, link missions to goals and update progress
      // For now, this is a placeholder
    }
  }
}
