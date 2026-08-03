import { MissionProgress } from '../domain';
import { DomainEvent, DomainEventBuilder, IEventStore, IEventBus } from '../events';
import { IProgressService } from './ServiceInterfaces';
import { IMissionProgressRepository } from '../repository';
import { createUUID, now, addDays, daysSince } from '../shared';

/**
 * ProgressService calculates derived metrics from events.
 *
 * Core principle: All metrics derive from events, never duplicated state.
 * Progress is movement towards outcomes, not lesson completion.
 *
 * Metrics (all derived from events):
 * - Goal completion %
 * - Mission completion %
 * - Skill growth
 * - Learning velocity (hours/week)
 * - Consistency (days studied/last 30 days)
 * - Time invested
 * - Streak quality
 * - Confidence level
 *
 * Read models:
 * - Learner dashboard
 * - Progress timeline
 * - Learning velocity chart
 * - Streak tracking
 * - Skill profile
 *
 * Events consumed:
 * - MissionStarted
 * - LessonCompleted
 * - MissionCompleted
 * - MissionAbandoned
 */
export class ProgressService implements IProgressService {
  private cache = new Map<string, MissionProgress>();

  constructor(
    private eventStore: IEventStore,
    private eventBus: IEventBus,
    private repository: IMissionProgressRepository
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
   * Get progress for a learner-mission pair.
   */
  async getProgress(learnerId: string, missionId: string): Promise<MissionProgress | null> {
    const cacheKey = `${learnerId}:${missionId}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const progress = await this.repository.findByLearnerAndMission(learnerId, missionId);

    if (progress) {
      this.cache.set(cacheKey, progress);
      return progress;
    }

    // Reconstruct from events
    const reconstructed = await this.reconstructProgressFromEvents(learnerId, missionId);
    if (reconstructed) {
      this.cache.set(cacheKey, reconstructed);
      return reconstructed;
    }

    return null;
  }

  /**
   * Get all progress for a learner.
   */
  async getProgressByLearner(learnerId: string): Promise<MissionProgress[]> {
    return this.repository.findByLearnerId(learnerId);
  }

  /**
   * Get comprehensive progress summary for learner.
   * Derives all metrics from aggregated mission progress.
   */
  async getSummary(
    learnerId: string
  ): Promise<{
    totalCompleted: number;
    totalHoursSpent: number;
    averageComprehension: number;
    currentStreak: number;
  }> {
    // Query all missions for learner
    const missions = await this.repository.findByLearnerId(learnerId);

    // Aggregate completed missions
    const completed = missions.filter((m) => m.status === 'completed');
    const totalCompleted = completed.length;

    // Sum time invested
    const totalHoursSpent = completed.reduce((sum, m) => sum + (m.timeSpentHours || 0), 0);

    // Average comprehension
    const averageComprehension =
      completed.length > 0
        ? completed.reduce((sum, m) => sum + m.comprehensionScore, 0) / completed.length
        : 0;

    // Calculate streak from mission events
    const streak = await this.calculateCurrentStreak(learnerId);

    return {
      totalCompleted,
      totalHoursSpent,
      averageComprehension,
      currentStreak: streak,
    };
  }

  /**
   * Start a mission.
   * Produces: MissionStarted
   */
  async startMission(learnerId: string, missionId: string): Promise<MissionProgress> {
    const progressId = createUUID();
    const timestamp = now();

    // Create initial progress record
    const progress = MissionProgress.create({
      learnerId,
      missionId,
      tenantId: 'tenant-default', // Should come from context
      lessonsTotal: 0, // Will be updated as lessons complete
    });

    // Create event
    const event = new DomainEventBuilder('MissionStarted', missionId, 'Mission')
      .setTenantId('tenant-default')
      .setData({
        learnerId,
        missionId,
        startedAt: timestamp,
      })
      .setVersion(1)
      .build();

    // Persist event
    await this.eventStore.append(event);

    // Update progress status
    const started = progress.withStatus('in-progress');
    await this.repository.save(started);

    // Cache
    const cacheKey = `${learnerId}:${missionId}`;
    this.cache.set(cacheKey, started);

    // Publish
    await this.eventBus.publish(event);

    return started;
  }

  /**
   * Complete a mission.
   * Produces: MissionCompleted
   */
  async completeMission(
    learnerId: string,
    missionId: string,
    comprehensionScore: number,
    timeSpentHours: number
  ): Promise<MissionProgress> {
    const progress = await this.getProgress(learnerId, missionId);

    if (!progress) {
      throw new Error(`Progress not found for learner ${learnerId}, mission ${missionId}`);
    }

    const timestamp = now();

    // Create event
    const event = new DomainEventBuilder('MissionCompleted', missionId, 'Mission')
      .setTenantId('tenant-default')
      .setData({
        learnerId,
        missionId,
        comprehensionScore,
        timeSpentHours,
        completedAt: timestamp,
      })
      .setVersion(1)
      .build();

    // Persist event
    await this.eventStore.append(event);

    // Update progress: mark as completed with final scores
    const completed = progress.withStatus('completed');
    // Note: In full implementation, would track comprehension and time via lesson events
    await this.repository.save(completed);

    // Cache
    const cacheKey = `${learnerId}:${missionId}`;
    this.cache.set(cacheKey, completed);

    // Publish (triggers goal progress update, achievement check, etc.)
    await this.eventBus.publish(event);

    return completed;
  }

  /**
   * Abandon a mission.
   * Produces: MissionAbandoned
   */
  async abandonMission(learnerId: string, missionId: string): Promise<MissionProgress> {
    const progress = await this.getProgress(learnerId, missionId);

    if (!progress) {
      throw new Error(`Progress not found for learner ${learnerId}, mission ${missionId}`);
    }

    const timestamp = now();

    // Create event
    const event = new DomainEventBuilder('MissionAbandoned', missionId, 'Mission')
      .setTenantId('tenant-default')
      .setData({
        learnerId,
        missionId,
        abandonedAt: timestamp,
      })
      .setVersion(1)
      .build();

    // Persist event
    await this.eventStore.append(event);

    // Update progress
    const abandoned = progress.withStatus('abandoned');
    await this.repository.save(abandoned);

    // Cache
    const cacheKey = `${learnerId}:${missionId}`;
    this.cache.set(cacheKey, abandoned);

    // Publish
    await this.eventBus.publish(event);

    return abandoned;
  }

  /**
   * Calculate current learning streak.
   * Queries event history to determine consecutive days of activity.
   */
  private async calculateCurrentStreak(learnerId: string): Promise<number> {
    // Query all LearningSessionRecorded events for learner
    const allEvents = await this.eventStore.getAllEvents();

    const sessionEvents = allEvents
      .filter(
        (e) =>
          e.eventType === 'LearningSessionRecorded' &&
          (e.data as Record<string, unknown>).learnerId === learnerId
      )
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (sessionEvents.length === 0) {
      return 0;
    }

    // Extract unique dates
    const sessionDates = new Set<string>();
    for (const event of sessionEvents) {
      const dateStr = (event.data as Record<string, unknown>).sessionStartedAt;
      if (typeof dateStr === 'string') {
        const date: string = dateStr.split('T')[0]!; // Extract YYYY-MM-DD
        sessionDates.add(date);
      }
    }

    if (sessionDates.size === 0) {
      return 0;
    }

    // Check consecutive days from most recent
    const sortedDates = Array.from(sessionDates).sort().reverse();
    let streak = 1;
    const today = new Date().toISOString().split('T')[0];

    // Start from today or yesterday (depending on whether there's activity today)
    const firstDate = sortedDates[0];
    if (!firstDate) return 0;

    let currentDate = new Date(firstDate);
    if (firstDate !== today) {
      currentDate.setDate(currentDate.getDate() - 1);
    }

    for (let i = 1; i < sortedDates.length; i++) {
      const nextDateStr = sortedDates[i];
      if (!nextDateStr) break;
      const previousDate = new Date(nextDateStr);
      const dayDifference =
        (currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24);

      if (dayDifference === 1) {
        streak++;
        currentDate = previousDate;
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * Reconstruct mission progress from events.
   */
  private async reconstructProgressFromEvents(
    learnerId: string,
    missionId: string
  ): Promise<MissionProgress | null> {
    const events = await this.eventStore.query({
      aggregateId: missionId,
    });

    if (events.length === 0) {
      return null;
    }

    // Initialize from MissionStarted event
    const startEvent = events.find((e) => e.eventType === 'MissionStarted');

    if (!startEvent) {
      return null;
    }

    const startData = startEvent.data as Record<string, unknown>;
    const lessonsTotal = (startData.lessonsTotal as number) || 0;

    let progress = MissionProgress.create({
      learnerId,
      missionId,
      lessonsTotal,
      tenantId: startEvent.tenantId,
    });

    // Replay events
    for (const event of events) {
      if (event.eventType === 'LessonCompleted') {
        const eventData = event.data as Record<string, unknown>;
        progress = progress.withLessonCompleted(
          eventData.comprehensionScore as number,
          (eventData.timeSpentMinutes as number) / 60
        );
      } else if (event.eventType === 'MissionCompleted') {
        const eventData = event.data as Record<string, unknown>;
        progress = progress.withStatus('completed');
      } else if (event.eventType === 'MissionAbandoned') {
        progress = progress.withStatus('abandoned');
      }
    }

    return progress;
  }

  /**
   * Handle events from other services.
   * ProgressService reacts to learner and mission events.
   */
  async handleEvent(event: DomainEvent): Promise<void> {
    // Invalidate cache on relevant events
    if (
      ['MissionStarted', 'MissionCompleted', 'MissionAbandoned', 'LessonCompleted'].includes(
        event.eventType
      )
    ) {
      // Clear cache for affected learner-mission pair
      const data = event.data as Record<string, unknown>;
      const learnerId = data.learnerId as string;
      const missionId = data.missionId as string;
      const cacheKey = `${learnerId}:${missionId}`;
      this.cache.delete(cacheKey);
    }
  }
}
