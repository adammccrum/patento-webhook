/**
 * IrisKey Platform - Event System
 * Event-driven architecture for decoupled services
 */

import type { UserSession } from '@iriskey/contracts';

/**
 * Base event interface
 */
export interface PlatformEvent {
  id: string;
  type: string;
  productId: string;
  timestamp: Date;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Specific event types
 */
export interface UserRegisteredEvent extends PlatformEvent {
  type: 'user:registered';
  userId: string;
  email: string;
  name?: string;
}

export interface UserLoggedInEvent extends PlatformEvent {
  type: 'user:logged_in';
  userId: string;
  provider: string;
  ipAddress?: string;
}

export interface UserLoggedOutEvent extends PlatformEvent {
  type: 'user:logged_out';
  userId: string;
}

export interface EmailVerifiedEvent extends PlatformEvent {
  type: 'email:verified';
  userId: string;
  email: string;
}

export interface PasswordResetEvent extends PlatformEvent {
  type: 'password:reset';
  userId: string;
  email: string;
}

export interface ProfileUpdatedEvent extends PlatformEvent {
  type: 'profile:updated';
  userId: string;
  fields: string[];
}

export interface SettingsUpdatedEvent extends PlatformEvent {
  type: 'settings:updated';
  userId: string;
  fields: string[];
}

export interface CreditsUsedEvent extends PlatformEvent {
  type: 'credits:used';
  userId: string;
  amount: number;
  reason: string;
  service?: string;
}

export interface CreditsAllocatedEvent extends PlatformEvent {
  type: 'credits:allocated';
  userId: string;
  amount: number;
  reason: string;
}

export interface SubscriptionCreatedEvent extends PlatformEvent {
  type: 'subscription:created';
  userId: string;
  subscriptionId: string;
  planId: string;
  amount: number;
}

export interface SubscriptionCancelledEvent extends PlatformEvent {
  type: 'subscription:cancelled';
  userId: string;
  subscriptionId: string;
  reason?: string;
}

export interface PaymentReceivedEvent extends PlatformEvent {
  type: 'payment:received';
  userId: string;
  paymentId: string;
  amount: number;
  currency: string;
}

export interface AIRequestStartedEvent extends PlatformEvent {
  type: 'ai:request_started';
  userId: string;
  requestId: string;
  model: string;
  provider: string;
}

export interface AIRequestCompletedEvent extends PlatformEvent {
  type: 'ai:request_completed';
  userId: string;
  requestId: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

export interface NotificationSentEvent extends PlatformEvent {
  type: 'notification:sent';
  userId: string;
  channel: 'email' | 'sms' | 'push';
  templateId: string;
  status: 'success' | 'failed';
}

export type PlatformEventType =
  | UserRegisteredEvent
  | UserLoggedInEvent
  | UserLoggedOutEvent
  | EmailVerifiedEvent
  | PasswordResetEvent
  | ProfileUpdatedEvent
  | SettingsUpdatedEvent
  | CreditsUsedEvent
  | CreditsAllocatedEvent
  | SubscriptionCreatedEvent
  | SubscriptionCancelledEvent
  | PaymentReceivedEvent
  | AIRequestStartedEvent
  | AIRequestCompletedEvent
  | NotificationSentEvent;

/**
 * Event handler type
 */
type EventHandler<E extends PlatformEvent = PlatformEvent> = (event: E) => Promise<void> | void;

/**
 * Event emitter for platform events
 */
class EventEmitter {
  private static instance: EventEmitter;
  private handlers: Map<string, Set<EventHandler>> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): EventEmitter {
    if (!EventEmitter.instance) {
      EventEmitter.instance = new EventEmitter();
    }
    return EventEmitter.instance;
  }

  /**
   * Subscribe to an event type
   */
  on<E extends PlatformEvent>(eventType: string, handler: EventHandler<E>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    // Handlers are stored erased to PlatformEvent; callers narrow by event type.
    this.handlers.get(eventType)!.add(handler as EventHandler);
  }

  /**
   * Subscribe to an event type, run once then unsubscribe
   */
  once<E extends PlatformEvent>(eventType: string, handler: EventHandler<E>): void {
    const wrappedHandler: EventHandler = async (event: PlatformEvent) => {
      await handler(event as E);
      this.off(eventType, wrappedHandler);
    };
    this.on(eventType, wrappedHandler);
  }

  /**
   * Unsubscribe from an event type
   */
  off(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Emit an event to all subscribed handlers
   */
  async emit<E extends PlatformEvent>(event: E): Promise<void> {
    const handlers = this.handlers.get(event.type);
    if (!handlers || handlers.size === 0) {
      return;
    }

    // Run handlers in parallel, but don't fail if one errors
    const promises = Array.from(handlers).map((handler) =>
      Promise.resolve()
        .then(() => handler(event))
        .catch((error) => {
          console.error(`Error in event handler for ${event.type}:`, error);
        })
    );

    await Promise.all(promises);
  }

  /**
   * Get number of handlers for an event type
   */
  listenerCount(eventType: string): number {
    return this.handlers.get(eventType)?.size ?? 0;
  }

  /**
   * Remove all listeners for an event type or all events
   */
  removeAllListeners(eventType?: string): void {
    if (eventType) {
      this.handlers.delete(eventType);
    } else {
      this.handlers.clear();
    }
  }
}

/**
 * Get event emitter instance
 */
export function getEventEmitter(): EventEmitter {
  return EventEmitter.getInstance();
}

/**
 * Subscribe to an event
 */
export function onEvent<E extends PlatformEvent>(
  eventType: string,
  handler: EventHandler<E>
): void {
  getEventEmitter().on(eventType, handler);
}

/**
 * Subscribe to an event once
 */
export function onceEvent<E extends PlatformEvent>(
  eventType: string,
  handler: EventHandler<E>
): void {
  getEventEmitter().once(eventType, handler);
}

/**
 * Unsubscribe from an event
 */
export function offEvent(eventType: string, handler: EventHandler): void {
  getEventEmitter().off(eventType, handler);
}

/**
 * Emit an event
 */
export async function emitEvent<E extends PlatformEvent>(event: E): Promise<void> {
  await getEventEmitter().emit(event);
}

/**
 * Create a unique event ID
 */
export function createEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Helper to create events with common fields
 */
export function createEvent<T extends PlatformEvent>(
  type: string,
  productId: string,
  userId?: string,
  metadata?: Record<string, unknown>
): Omit<T, 'id' | 'type' | 'timestamp'> & {
  id: string;
  type: string;
  timestamp: Date;
} {
  return {
    id: createEventId(),
    type,
    productId,
    userId,
    timestamp: new Date(),
    metadata,
  } as any;
}

/**
 * Event names for type safety
 */
export const EVENTS = {
  USER_REGISTERED: 'user:registered',
  USER_LOGGED_IN: 'user:logged_in',
  USER_LOGGED_OUT: 'user:logged_out',
  EMAIL_VERIFIED: 'email:verified',
  PASSWORD_RESET: 'password:reset',
  PROFILE_UPDATED: 'profile:updated',
  SETTINGS_UPDATED: 'settings:updated',
  CREDITS_USED: 'credits:used',
  CREDITS_ALLOCATED: 'credits:allocated',
  SUBSCRIPTION_CREATED: 'subscription:created',
  SUBSCRIPTION_CANCELLED: 'subscription:cancelled',
  PAYMENT_RECEIVED: 'payment:received',
  AI_REQUEST_STARTED: 'ai:request_started',
  AI_REQUEST_COMPLETED: 'ai:request_completed',
  NOTIFICATION_SENT: 'notification:sent',
} as const;

/**
 * Export EventEmitter class for advanced use
 */
export { EventEmitter };
