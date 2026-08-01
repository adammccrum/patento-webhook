import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryEventBus, MockEventBus } from '../../src/events/EventBus';
import { DomainEventBuilder } from '../../src/events/DomainEvent';

describe('EventBus', () => {
  let eventBus: InMemoryEventBus;

  beforeEach(() => {
    eventBus = new InMemoryEventBus();
  });

  describe('Publishing and subscription', () => {
    it('should deliver events to subscribers', async () => {
      const handler = vi.fn();
      await eventBus.subscribe('UserOnboarded', handler);

      const event = new DomainEventBuilder('UserOnboarded', 'learner-123', 'Learner')
        .setTenantId('tenant-1')
        .setData({ learnerId: 'learner-123' })
        .build();

      await eventBus.publish(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should not deliver events to non-matching subscribers', async () => {
      const handler = vi.fn();
      await eventBus.subscribe('GoalCreated', handler);

      const event = new DomainEventBuilder('UserOnboarded', 'learner-123', 'Learner')
        .setTenantId('tenant-1')
        .setData({ recorded: true })
        .build();

      await eventBus.publish(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should support wildcard subscriptions', async () => {
      const handler = vi.fn();
      await eventBus.subscribeAll(handler);

      const event1 = new DomainEventBuilder('UserOnboarded', 'learner-123', 'Learner')
        .setTenantId('tenant-1')
        .setData({ recorded: true })
        .build();

      const event2 = new DomainEventBuilder('GoalCreated', 'goal-123', 'Goal')
        .setTenantId('tenant-1')
        .setData({ recorded: true })
        .build();

      await eventBus.publish(event1);
      await eventBus.publish(event2);

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should allow unsubscription', async () => {
      const handler = vi.fn();
      const subscriptionId = await eventBus.subscribe('UserOnboarded', handler);

      const event = new DomainEventBuilder('UserOnboarded', 'learner-123', 'Learner')
        .setTenantId('tenant-1')
        .setData({ recorded: true })
        .build();

      await eventBus.publish(event);
      expect(handler).toHaveBeenCalledTimes(1);

      await eventBus.unsubscribe(subscriptionId);
      await eventBus.publish(event);

      expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should handle handler errors gracefully', async () => {
      const errorHandler = vi.fn().mockRejectedValue(new Error('Handler failed'));
      const successHandler = vi.fn();

      await eventBus.subscribe('UserOnboarded', errorHandler);
      await eventBus.subscribe('UserOnboarded', successHandler);

      const event = new DomainEventBuilder('UserOnboarded', 'learner-123', 'Learner')
        .setTenantId('tenant-1')
        .setData({ recorded: true })
        .build();

      // Should not throw, should invoke both handlers
      await expect(eventBus.publish(event)).resolves.toBeUndefined();
      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
    });
  });

  describe('Subscription management', () => {
    it('should return subscription list', async () => {
      await eventBus.subscribe('UserOnboarded', async () => {});
      await eventBus.subscribe('GoalCreated', async () => {});

      const subscriptions = eventBus.getSubscriptions();
      expect(subscriptions).toHaveLength(2);
      expect(subscriptions.some((s) => s.eventType === 'UserOnboarded')).toBe(true);
      expect(subscriptions.some((s) => s.eventType === 'GoalCreated')).toBe(true);
    });

    it('should track subscription timestamp', async () => {
      const before = new Date().toISOString();
      await eventBus.subscribe('UserOnboarded', async () => {});
      const after = new Date().toISOString();

      const subscriptions = eventBus.getSubscriptions();
      const subscription = subscriptions[0];

      expect(subscription.subscribedAt >= before).toBe(true);
      expect(subscription.subscribedAt <= after).toBe(true);
    });
  });

  describe('Health check', () => {
    it('should report healthy', async () => {
      const health = await eventBus.health();
      expect(health).toBe(true);
    });
  });

  describe('MockEventBus', () => {
    let mockBus: MockEventBus;

    beforeEach(() => {
      mockBus = new MockEventBus();
    });

    it('should record published events', async () => {
      const event = new DomainEventBuilder('UserOnboarded', 'learner-123', 'Learner')
        .setTenantId('tenant-1')
        .setData({ recorded: true })
        .build();

      await mockBus.publish(event);

      expect(mockBus.publishedEvents).toHaveLength(1);
      expect(mockBus.publishedEvents[0].eventId).toBe(event.eventId);
    });

    it('should filter events by type', async () => {
      const event1 = new DomainEventBuilder('UserOnboarded', 'learner-123', 'Learner')
        .setTenantId('tenant-1')
        .setData({ recorded: true })
        .build();

      const event2 = new DomainEventBuilder('GoalCreated', 'goal-123', 'Goal')
        .setTenantId('tenant-1')
        .setData({ recorded: true })
        .build();

      await mockBus.publish(event1);
      await mockBus.publish(event2);

      const onboarded = mockBus.getEventsByType('UserOnboarded');
      expect(onboarded).toHaveLength(1);
      expect(onboarded[0].eventType).toBe('UserOnboarded');
    });

    it('should allow clearing events', async () => {
      const event = new DomainEventBuilder('UserOnboarded', 'learner-123', 'Learner')
        .setTenantId('tenant-1')
        .setData({ recorded: true })
        .build();

      await mockBus.publish(event);
      expect(mockBus.publishedEvents).toHaveLength(1);

      mockBus.clear();
      expect(mockBus.publishedEvents).toHaveLength(0);
    });
  });
});
