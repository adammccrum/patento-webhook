import { Learner, LearnerPreferences } from '../domain';
import { DomainEvent, DomainEventBuilder, IEventStore, IEventBus } from '../events';
import { ILearnerService } from './ServiceInterfaces';
import { ILearnerRepository } from '../repository';
import { createUUID, now } from '../shared';
import {
  RegisterLearnerCommand,
  CompleteOnboardingCommand,
  PauseLearningCommand,
  ResumeLearningCommand,
  UpdatePreferencesCommand,
  RecordLearningSessionCommand,
} from './commands/LearnerCommands';

/**
 * LearnerService owns learner identity and state.
 *
 * Core principle: Events are the source of truth.
 * Current learner state is reconstructed from event history.
 *
 * Commands:
 * - RegisterLearner → [LearnerRegistered, UserOnboarded]
 * - CompleteOnboarding → [LearnerOnboarded]
 * - PauseLearning → [LearnerStateChanged]
 * - ResumeLearning → [LearnerStateChanged]
 * - UpdatePreferences → [LearnerPreferencesUpdated]
 * - RecordLearningSession → [LearningSessionRecorded]
 *
 * Read models:
 * - Learner dashboard (name, state, current streak, total hours)
 * - Activity timeline (recent sessions, state changes)
 * - Learning velocity (hours per week trend)
 */
export class LearnerService implements ILearnerService {
  private cache = new Map<string, Learner>();
  private eventIndex = new Map<string, DomainEvent[]>();

  constructor(
    private eventStore: IEventStore,
    private eventBus: IEventBus,
    private repository: ILearnerRepository
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
   * Register a new learner.
   * Produces: LearnerRegistered, UserOnboarded
   */
  async registerLearner(command: RegisterLearnerCommand): Promise<Learner> {
    const timestamp = command.timestamp || now();

    // Validate email is unique
    const existing = await this.repository.findByEmail(command.email);
    if (existing) {
      throw new Error(`Email already registered: ${command.email}`);
    }

    // Create learner in draft state - this generates the ID
    const learner = Learner.create({
      email: command.email,
      name: command.name,
      preferences: command.preferences,
      tenantId: command.tenantId,
    });

    const learnerId = learner.id; // Use the generated ID

    // Event 1: LearnerRegistered (foundation fact)
    const registeredEvent = new DomainEventBuilder('LearnerRegistered', learnerId, 'Learner')
      .setTenantId(command.tenantId)
      .setData({
        learnerId,
        email: command.email,
        name: command.name,
        registeredAt: timestamp,
      })
      .setVersion(1)
      .build();

    // Event 2: UserOnboarded (immediate transition for registration flow)
    const onboardedEvent = new DomainEventBuilder(
      'UserOnboarded',
      learnerId,
      'Learner',
      registeredEvent.correlationId
    )
      .setTenantId(command.tenantId)
      .setCausalChain('system', 'learner_registration', registeredEvent.eventId)
      .setData({
        learnerId,
        email: command.email,
        name: command.name,
        learningStyle: command.preferences.learningStyle,
        pacePreference: command.preferences.pacePreference,
        timezone: command.preferences.timezone,
        onboardedAt: timestamp,
      })
      .setVersion(1)
      .build();

    // Persist events
    await this.eventStore.appendBatch([registeredEvent, onboardedEvent]);

    // Update learner state with onboarded timestamp
    const updated = learner.withProfile({
      onboardedAt: timestamp,
    });

    // Save to repository as read model
    await this.repository.save(updated);

    // Cache and publish
    this.cache.set(learnerId, updated);
    await this.eventBus.publish(registeredEvent);
    await this.eventBus.publish(onboardedEvent);

    return updated;
  }

  /**
   * Get learner by ID.
   * First checks cache, then reconstructs from events if needed.
   */
  async getLearner(learnerId: string): Promise<Learner | null> {
    // Check cache first
    if (this.cache.has(learnerId)) {
      return this.cache.get(learnerId)!;
    }

    // Try repository read model
    const learner = await this.repository.findById(learnerId);
    if (learner) {
      this.cache.set(learnerId, learner);
      return learner;
    }

    // Reconstruct from events (recovery path)
    const learner_reconstructed = await this.reconstructLearnerFromEvents(learnerId);
    if (learner_reconstructed) {
      this.cache.set(learnerId, learner_reconstructed);
      return learner_reconstructed;
    }

    return null;
  }

  /**
   * Get learner by email (repository read model).
   */
  async getLearnerByEmail(email: string): Promise<Learner | null> {
    return this.repository.findByEmail(email);
  }

  /**
   * Update learner preferences.
   * Produces: LearnerPreferencesUpdated
   */
  async updatePreferences(
    learnerId: string,
    preferences: Partial<LearnerPreferences>
  ): Promise<Learner> {
    const learner = await this.getLearner(learnerId);
    if (!learner) {
      throw new Error(`Learner not found: ${learnerId}`);
    }

    const timestamp = now();

    // Create event
    const event = new DomainEventBuilder('LearnerPreferencesUpdated', learnerId, 'Learner')
      .setTenantId(learner.tenantId)
      .setData({
        learnerId,
        ...preferences,
        updatedAt: timestamp,
      })
      .setVersion(1)
      .build();

    // Persist event
    await this.eventStore.append(event);

    // Update in-memory state
    const updated = learner.withPreferences(preferences);
    this.cache.set(learnerId, updated);
    await this.repository.save(updated);

    // Publish
    await this.eventBus.publish(event);

    return updated;
  }

  /**
   * Update learner state (active, paused, inactive, etc).
   * Produces: LearnerStateChanged
   */
  async updateState(learnerId: string, state: string): Promise<Learner> {
    const learner = await this.getLearner(learnerId);
    if (!learner) {
      throw new Error(`Learner not found: ${learnerId}`);
    }

    const timestamp = now();

    // Create event
    const event = new DomainEventBuilder('LearnerStateChanged', learnerId, 'Learner')
      .setTenantId(learner.tenantId)
      .setData({
        learnerId,
        fromState: learner.state,
        toState: state,
        transitionedAt: timestamp,
      })
      .setVersion(1)
      .build();

    // Persist event
    await this.eventStore.append(event);

    // Update in-memory state
    const updated = learner.withState(state);
    this.cache.set(learnerId, updated);
    await this.repository.save(updated);

    // Publish
    await this.eventBus.publish(event);

    return updated;
  }

  /**
   * Record learning session activity.
   * Updates lastActiveAt timestamp.
   * Produces: LearningSessionRecorded
   */
  async recordActivity(learnerId: string): Promise<Learner> {
    const learner = await this.getLearner(learnerId);
    if (!learner) {
      throw new Error(`Learner not found: ${learnerId}`);
    }

    const timestamp = now();

    // Create event
    const event = new DomainEventBuilder('LearningSessionRecorded', learnerId, 'Learner')
      .setTenantId(learner.tenantId)
      .setData({
        learnerId,
        sessionStartedAt: timestamp,
      })
      .setVersion(1)
      .build();

    // Persist event
    await this.eventStore.append(event);

    // Update in-memory state
    const updated = learner.withLastActiveAt(timestamp);
    this.cache.set(learnerId, updated);
    await this.repository.save(updated);

    // Publish
    await this.eventBus.publish(event);

    return updated;
  }

  /**
   * Reconstruct learner aggregate from event history.
   * This is the event sourcing recovery path.
   * Used when read model (repository) is out of sync.
   */
  private async reconstructLearnerFromEvents(learnerId: string): Promise<Learner | null> {
    const events = await this.eventStore.getEventsByAggregateId(learnerId);

    if (events.length === 0) {
      return null;
    }

    // Find LearnerRegistered or UserOnboarded event to initialize
    const initEvent = events.find((e) =>
      ['LearnerRegistered', 'UserOnboarded'].includes(e.eventType)
    );

    if (!initEvent) {
      return null;
    }

    const data = initEvent.data as Record<string, unknown>;
    let learner = Learner.create({
      email: data.email as string,
      name: data.name as string,
      preferences: {
        learningStyle: (data.learningStyle as string) || 'visual',
        pacePreference: (data.pacePreference as string) || 'normal',
        availableHoursPerWeek: (data.availableHoursPerWeek as number) || 10,
        preferredLanguage: (data.preferredLanguage as string) || 'en',
        timezone: (data.timezone as string) || 'UTC',
        topicsOfInterest: (data.topicsOfInterest as string[]) || [],
        careersOfInterest: (data.careersOfInterest as string[]) || [],
      },
      tenantId: initEvent.tenantId,
    });

    // Replay remaining events
    for (const event of events) {
      if (event.eventType === 'LearnerStateChanged') {
        const eventData = event.data as Record<string, unknown>;
        learner = learner.withState(eventData.toState as string);
      } else if (event.eventType === 'LearnerPreferencesUpdated') {
        const eventData = event.data as Record<string, unknown>;
        learner = learner.withPreferences({
          learningStyle: eventData.learningStyle as string,
          pacePreference: eventData.pacePreference as string,
          availableHoursPerWeek: eventData.availableHoursPerWeek as number,
          timezone: eventData.timezone as string,
        });
      } else if (event.eventType === 'LearningSessionRecorded') {
        const eventData = event.data as Record<string, unknown>;
        learner = learner.withLastActiveAt(eventData.sessionStartedAt as string);
      }
    }

    return learner;
  }

  /**
   * Handle events from other services (event subscription).
   * LearnerService is mostly independent, but may react to system events.
   */
  async handleEvent(event: DomainEvent): Promise<void> {
    // For now, learner service doesn't react to other events.
    // In future: could listen to AchievementUnlocked, CreditsAwarded, etc.
    // and update derived metrics.
  }
}
