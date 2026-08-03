import { DomainEvent, validateEvent } from './DomainEvent';

/**
 * Query criteria for searching the event store.
 */
export interface EventQueryCriteria {
  eventType?: string;
  aggregateId?: string;
  aggregateType?: string;
  correlationId?: string;
  tenantId?: string;
  startTime?: string; // ISO 8601
  endTime?: string; // ISO 8601
  limit?: number;
  offset?: number;
}

/**
 * Result of appending an event.
 */
export interface AppendResult {
  eventId: string;
  sequenceNumber: number;
  storedAt: string;
}

/**
 * EventStore is the append-only log of domain events.
 * All changes flow through events (event sourcing foundation).
 *
 * Contract:
 * - Events are immutable once stored
 * - Events are ordered by sequence number
 * - Events can be queried and replayed
 * - Events can be archived/purged (with retention policy)
 */
export interface IEventStore {
  /**
   * Append an event to the store.
   * Must be idempotent: appending the same event twice should return same result.
   */
  append(event: DomainEvent): Promise<AppendResult>;

  /**
   * Append multiple events atomically (all or none).
   */
  appendBatch(events: DomainEvent[]): Promise<AppendResult[]>;

  /**
   * Get event by ID.
   */
  getEventById(eventId: string): Promise<DomainEvent | null>;

  /**
   * Get all events for an aggregate (ordered by sequence).
   */
  getEventsByAggregateId(aggregateId: string, limit?: number): Promise<DomainEvent[]>;

  /**
   * Query events by criteria.
   */
  query(criteria: EventQueryCriteria): Promise<DomainEvent[]>;

  /**
   * Get all events in order (for replay, subscription catch-up, etc.).
   */
  getAllEvents(fromSequenceNumber?: number, limit?: number): Promise<DomainEvent[]>;

  /**
   * Get event count for aggregate.
   */
  getEventCountByAggregateId(aggregateId: string): Promise<number>;

  /**
   * Archive old events (move to cold storage, typically done offline).
   * Implementation-specific; may be no-op in some stores.
   */
  archiveEventsBefore(timestamp: string): Promise<number>;

  /**
   * Health check.
   */
  health(): Promise<boolean>;
}

/**
 * In-memory event store for development and testing.
 * Not suitable for production (no persistence, single instance only).
 */
export class InMemoryEventStore implements IEventStore {
  private events: DomainEvent[] = [];
  private eventIdMap = new Map<string, DomainEvent>();
  private sequenceNumber = 0;

  async append(event: DomainEvent): Promise<AppendResult> {
    validateEvent(event);

    // Idempotency: if event with same ID already exists, return existing result
    if (this.eventIdMap.has(event.eventId)) {
      const existing = this.eventIdMap.get(event.eventId)!;
      const index = this.events.indexOf(existing);
      return {
        eventId: event.eventId,
        sequenceNumber: index + 1,
        storedAt: new Date().toISOString(),
      };
    }

    // Add event
    this.events.push(event);
    this.eventIdMap.set(event.eventId, event);
    this.sequenceNumber++;

    return {
      eventId: event.eventId,
      sequenceNumber: this.sequenceNumber,
      storedAt: new Date().toISOString(),
    };
  }

  async appendBatch(events: DomainEvent[]): Promise<AppendResult[]> {
    const results: AppendResult[] = [];
    for (const event of events) {
      results.push(await this.append(event));
    }
    return results;
  }

  async getEventById(eventId: string): Promise<DomainEvent | null> {
    return this.eventIdMap.get(eventId) || null;
  }

  async getEventsByAggregateId(aggregateId: string, limit?: number): Promise<DomainEvent[]> {
    const result = this.events.filter((e) => e.aggregateId === aggregateId);
    return limit ? result.slice(0, limit) : result;
  }

  async query(criteria: EventQueryCriteria): Promise<DomainEvent[]> {
    let result = this.events;

    if (criteria.eventType) {
      result = result.filter((e) => e.eventType === criteria.eventType);
    }
    if (criteria.aggregateId) {
      result = result.filter((e) => e.aggregateId === criteria.aggregateId);
    }
    if (criteria.aggregateType) {
      result = result.filter((e) => e.aggregateType === criteria.aggregateType);
    }
    if (criteria.correlationId) {
      result = result.filter((e) => e.correlationId === criteria.correlationId);
    }
    if (criteria.tenantId) {
      result = result.filter((e) => e.tenantId === criteria.tenantId);
    }
    if (criteria.startTime) {
      const startTime = new Date(criteria.startTime).getTime();
      result = result.filter((e) => new Date(e.timestamp).getTime() >= startTime);
    }
    if (criteria.endTime) {
      const endTime = new Date(criteria.endTime).getTime();
      result = result.filter((e) => new Date(e.timestamp).getTime() <= endTime);
    }

    // Apply pagination
    const offset = criteria.offset || 0;
    const limit = criteria.limit || 100;
    return result.slice(offset, offset + limit);
  }

  async getAllEvents(fromSequenceNumber = 0, limit = 100): Promise<DomainEvent[]> {
    return this.events.slice(fromSequenceNumber, fromSequenceNumber + limit);
  }

  async getEventCountByAggregateId(aggregateId: string): Promise<number> {
    return this.events.filter((e) => e.aggregateId === aggregateId).length;
  }

  async archiveEventsBefore(_timestamp: string): Promise<number> {
    // No-op for in-memory store
    return 0;
  }

  async health(): Promise<boolean> {
    return true;
  }
}

/**
 * Mock event store for testing.
 * Records all operations for assertion.
 */
export class MockEventStore implements IEventStore {
  private events: DomainEvent[] = [];
  private eventIdMap = new Map<string, DomainEvent>();
  private sequenceNumber = 0;
  public appendCalls: DomainEvent[] = [];

  async append(event: DomainEvent): Promise<AppendResult> {
    validateEvent(event);
    this.appendCalls.push(event);

    if (this.eventIdMap.has(event.eventId)) {
      const existing = this.eventIdMap.get(event.eventId)!;
      const index = this.events.indexOf(existing);
      return {
        eventId: event.eventId,
        sequenceNumber: index + 1,
        storedAt: new Date().toISOString(),
      };
    }

    this.events.push(event);
    this.eventIdMap.set(event.eventId, event);
    this.sequenceNumber++;

    return {
      eventId: event.eventId,
      sequenceNumber: this.sequenceNumber,
      storedAt: new Date().toISOString(),
    };
  }

  async appendBatch(events: DomainEvent[]): Promise<AppendResult[]> {
    const results: AppendResult[] = [];
    for (const event of events) {
      results.push(await this.append(event));
    }
    return results;
  }

  async getEventById(eventId: string): Promise<DomainEvent | null> {
    return this.eventIdMap.get(eventId) || null;
  }

  async getEventsByAggregateId(aggregateId: string, limit?: number): Promise<DomainEvent[]> {
    const result = this.events.filter((e) => e.aggregateId === aggregateId);
    return limit ? result.slice(0, limit) : result;
  }

  async query(criteria: EventQueryCriteria): Promise<DomainEvent[]> {
    let result = this.events;

    if (criteria.eventType) {
      result = result.filter((e) => e.eventType === criteria.eventType);
    }
    if (criteria.aggregateId) {
      result = result.filter((e) => e.aggregateId === criteria.aggregateId);
    }

    const offset = criteria.offset || 0;
    const limit = criteria.limit || 100;
    return result.slice(offset, offset + limit);
  }

  async getAllEvents(fromSequenceNumber = 0, limit = 100): Promise<DomainEvent[]> {
    return this.events.slice(fromSequenceNumber, fromSequenceNumber + limit);
  }

  async getEventCountByAggregateId(aggregateId: string): Promise<number> {
    return this.events.filter((e) => e.aggregateId === aggregateId).length;
  }

  async archiveEventsBefore(_timestamp: string): Promise<number> {
    return 0;
  }

  async health(): Promise<boolean> {
    return true;
  }
}
