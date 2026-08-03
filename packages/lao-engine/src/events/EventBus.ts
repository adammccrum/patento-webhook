import { DomainEvent } from './DomainEvent';

/**
 * Event handler function type.
 * Handlers are async, may fail, and may be invoked multiple times (at-least-once delivery).
 */
export type EventHandler = (event: DomainEvent) => Promise<void>;

/**
 * Event subscription with metadata for lifecycle management.
 */
export interface EventSubscription {
  subscriptionId: string;
  eventType: string;
  handler: EventHandler;
  subscribedAt: string;
}

/**
 * EventBus is the central pub/sub hub for domain events.
 * Implementations may be in-memory, Redis-based, or message-queue-based.
 *
 * Contract:
 * - Events are delivered asynchronously to subscribers
 * - Delivery is at-least-once (may retry, may deliver duplicate)
 * - Handlers must be idempotent (safe to call multiple times)
 * - Events are immutable after publishing
 */
export interface IEventBus {
  /**
   * Publish an event to all subscribed handlers.
   * Returns when all handlers have been invoked (successfully or failed).
   */
  publish(event: DomainEvent): Promise<void>;

  /**
   * Subscribe a handler to events of a specific type.
   * Returns subscription ID for later unsubscription.
   */
  subscribe(eventType: string, handler: EventHandler): Promise<string>;

  /**
   * Subscribe to all events (wildcard).
   */
  subscribeAll(handler: EventHandler): Promise<string>;

  /**
   * Unsubscribe a handler.
   */
  unsubscribe(subscriptionId: string): Promise<void>;

  /**
   * Get all current subscriptions.
   */
  getSubscriptions(): EventSubscription[];

  /**
   * Health check.
   */
  health(): Promise<boolean>;
}

/**
 * In-memory event bus for development and testing.
 * Not suitable for production (no persistence, single instance only).
 */
export class InMemoryEventBus implements IEventBus {
  private subscriptions = new Map<string, EventSubscription>();
  private subscriptionCount = 0;

  async publish(event: DomainEvent): Promise<void> {
    const handlers: EventHandler[] = [];

    for (const subscription of this.subscriptions.values()) {
      if (subscription.eventType === '*' || subscription.eventType === event.eventType) {
        handlers.push(subscription.handler);
      }
    }

    // Execute handlers in parallel (order not guaranteed)
    await Promise.allSettled(handlers.map((h) => h(event)));
  }

  async subscribe(eventType: string, handler: EventHandler): Promise<string> {
    const subscriptionId = `sub_${++this.subscriptionCount}`;
    this.subscriptions.set(subscriptionId, {
      subscriptionId,
      eventType,
      handler,
      subscribedAt: new Date().toISOString(),
    });
    return subscriptionId;
  }

  async subscribeAll(handler: EventHandler): Promise<string> {
    return this.subscribe('*', handler);
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    this.subscriptions.delete(subscriptionId);
  }

  getSubscriptions(): EventSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  async health(): Promise<boolean> {
    return true;
  }
}

/**
 * Mock event bus for testing.
 * Records all published events for assertion.
 */
export class MockEventBus implements IEventBus {
  private subscriptions = new Map<string, EventSubscription>();
  private subscriptionCount = 0;
  public publishedEvents: DomainEvent[] = [];

  async publish(event: DomainEvent): Promise<void> {
    this.publishedEvents.push(event);

    const handlers: EventHandler[] = [];
    for (const subscription of this.subscriptions.values()) {
      if (subscription.eventType === '*' || subscription.eventType === event.eventType) {
        handlers.push(subscription.handler);
      }
    }

    await Promise.allSettled(handlers.map((h) => h(event)));
  }

  async subscribe(eventType: string, handler: EventHandler): Promise<string> {
    const subscriptionId = `sub_${++this.subscriptionCount}`;
    this.subscriptions.set(subscriptionId, {
      subscriptionId,
      eventType,
      handler,
      subscribedAt: new Date().toISOString(),
    });
    return subscriptionId;
  }

  async subscribeAll(handler: EventHandler): Promise<string> {
    return this.subscribe('*', handler);
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    this.subscriptions.delete(subscriptionId);
  }

  getSubscriptions(): EventSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  async health(): Promise<boolean> {
    return true;
  }

  // Test helpers
  getEventsByType(eventType: string): DomainEvent[] {
    return this.publishedEvents.filter((e) => e.eventType === eventType);
  }

  clear(): void {
    this.publishedEvents = [];
  }
}
