import { v4 as uuidv4 } from 'uuid';

/**
 * DomainEvent is the base type for all events in the LAO system.
 * Every event is immutable, versioned, and includes complete metadata
 * for audit trail, causality tracking, and replay.
 */
export interface DomainEvent {
  // Event identity and versioning
  eventId: string; // UUID
  eventType: string; // e.g., 'UserOnboarded', 'GoalCreated'
  version: number; // Schema version (for evolution)

  // Aggregate (entity) this event describes
  aggregateId: string; // UUID of root entity (e.g., learnerId)
  aggregateType: string; // Type name (e.g., 'Learner', 'Goal')

  // Causality and tracing
  correlationId: string; // Links related events (e.g., user action → multiple effects)
  causationId?: string; // Immediate cause (previous event that triggered this)
  causedByUserId?: string; // User who triggered (system or user ID)
  causedByAction?: string; // Human-readable action (e.g., 'clicked_create_goal')

  // Event payload (domain-specific data)
  data: Record<string, unknown>;

  // Metadata
  timestamp: string; // ISO 8601 UTC timestamp
  tenantId: string; // Multi-tenancy support
  sourceName?: string; // Service that emitted (e.g., 'LearnerService')
  sourceVersion?: string; // Version of source service
  userAgent?: string; // HTTP user agent if applicable
  ipAddress?: string; // Source IP for audit trail

  // Delivery metadata (added by event bus, not by producer)
  processedAt?: string; // When event was processed
  retryCount?: number; // How many times retried
  isReplay?: boolean; // True if this is a replay of historical event
}

/**
 * Strongly-typed event creator with validation.
 * Ensures all events have required fields and correct structure.
 */
export class DomainEventBuilder {
  private event: DomainEvent;

  constructor(
    eventType: string,
    aggregateId: string,
    aggregateType: string,
    correlationId?: string
  ) {
    this.event = {
      eventId: uuidv4(),
      eventType,
      version: 1,
      aggregateId,
      aggregateType,
      correlationId: correlationId || uuidv4(),
      data: {},
      timestamp: new Date().toISOString(),
      tenantId: '', // Must be set by caller
    };
  }

  setTenantId(tenantId: string): this {
    this.event.tenantId = tenantId;
    return this;
  }

  setData(data: Record<string, unknown>): this {
    this.event.data = data;
    return this;
  }

  setCausalChain(causedByUserId: string, causedByAction: string, causationId?: string): this {
    this.event.causedByUserId = causedByUserId;
    this.event.causedByAction = causedByAction;
    if (causationId) {
      this.event.causationId = causationId;
    }
    return this;
  }

  setSourceInfo(sourceName: string, sourceVersion?: string): this {
    this.event.sourceName = sourceName;
    this.event.sourceVersion = sourceVersion;
    return this;
  }

  setNetworkInfo(userAgent?: string, ipAddress?: string): this {
    this.event.userAgent = userAgent;
    this.event.ipAddress = ipAddress;
    return this;
  }

  setVersion(version: number): this {
    this.event.version = version;
    return this;
  }

  build(): DomainEvent {
    if (!this.event.tenantId) {
      throw new Error('tenantId is required for domain events');
    }
    if (!this.event.data || Object.keys(this.event.data).length === 0) {
      throw new Error('Event data cannot be empty');
    }
    return this.event;
  }
}

/**
 * Type-safe event payload for specific event types.
 * Each event type defines its own payload shape.
 */
export type EventPayload<T extends DomainEvent = DomainEvent> = T['data'];

/**
 * Validate event structure before persistence.
 */
export function validateEvent(event: DomainEvent): void {
  if (!event.eventId || typeof event.eventId !== 'string') {
    throw new Error('Invalid eventId');
  }
  if (!event.eventType || typeof event.eventType !== 'string') {
    throw new Error('Invalid eventType');
  }
  if (!event.aggregateId || typeof event.aggregateId !== 'string') {
    throw new Error('Invalid aggregateId');
  }
  if (!event.aggregateType || typeof event.aggregateType !== 'string') {
    throw new Error('Invalid aggregateType');
  }
  if (!event.correlationId || typeof event.correlationId !== 'string') {
    throw new Error('Invalid correlationId');
  }
  if (!event.timestamp || typeof event.timestamp !== 'string') {
    throw new Error('Invalid timestamp');
  }
  if (!event.tenantId || typeof event.tenantId !== 'string') {
    throw new Error('Invalid tenantId');
  }
  if (typeof event.version !== 'number' || event.version < 1) {
    throw new Error('Invalid version');
  }
  if (!event.data || typeof event.data !== 'object') {
    throw new Error('Invalid data payload');
  }
}
