import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from '../../src/events/EventStore';
import { DomainEventBuilder } from '../../src/events/DomainEvent';

describe('EventStore', () => {
  let store: InMemoryEventStore;

  beforeEach(() => {
    store = new InMemoryEventStore();
  });

  describe('Appending events', () => {
    it('should append an event', async () => {
      const event = new DomainEventBuilder('UserOnboarded', 'learner-123', 'Learner')
        .setTenantId('tenant-1')
        .setData({ learnerId: 'learner-123' })
        .build();

      const result = await store.append(event);

      expect(result.eventId).toBe(event.eventId);
      expect(result.sequenceNumber).toBe(1);
      expect(result.storedAt).toBeDefined();
    });

    it('should increment sequence numbers', async () => {
      const event1 = new DomainEventBuilder('UserOnboarded', 'learner-123', 'Learner')
        .setTenantId('tenant-1')
        .setData({})
        .build();

      const event2 = new DomainEventBuilder('GoalCreated', 'goal-123', 'Goal')
        .setTenantId('tenant-1')
        .setData({})
        .build();

      const result1 = await store.append(event1);
      const result2 = await store.append(event2);

      expect(result1.sequenceNumber).toBe(1);
      expect(result2.sequenceNumber).toBe(2);
    });

    it('should be idempotent (same event appended twice)', async () => {
      const event = new DomainEventBuilder('UserOnboarded', 'learner-123', 'Learner')
        .setTenantId('tenant-1')
        .setData({})
        .build();

      const result1 = await store.append(event);
      const result2 = await store.append(event);

      expect(result1.eventId).toBe(result2.eventId);
      expect(result1.sequenceNumber).toBe(result2.sequenceNumber);
      expect(await store.count()).toBe(1);
    });

    it('should batch append events', async () => {
      const events = [
        new DomainEventBuilder('UserOnboarded', 'learner-123', 'Learner')
          .setTenantId('tenant-1')
          .setData({})
          .build(),
        new DomainEventBuilder('GoalCreated', 'goal-123', 'Goal')
          .setTenantId('tenant-1')
          .setData({})
          .build(),
      ];

      const results = await store.appendBatch(events);

      expect(results).toHaveLength(2);
      expect(results[0].sequenceNumber).toBe(1);
      expect(results[1].sequenceNumber).toBe(2);
    });
  });

  describe('Querying events', () => {
    beforeEach(async () => {
      const event1 = new DomainEventBuilder('UserOnboarded', 'learner-123', 'Learner')
        .setTenantId('tenant-1')
        .setData({ learnerId: 'learner-123' })
        .build();

      const event2 = new DomainEventBuilder('GoalCreated', 'goal-123', 'Goal', 'correlation-1')
        .setTenantId('tenant-1')
        .setData({ goalId: 'goal-123' })
        .build();

      const event3 = new DomainEventBuilder('GoalCreated', 'goal-456', 'Goal', 'correlation-1')
        .setTenantId('tenant-1')
        .setData({ goalId: 'goal-456' })
        .build();

      await store.append(event1);
      await store.append(event2);
      await store.append(event3);
    });

    it('should get event by ID', async () => {
      const events = await store.getAllEvents();
      const event = events[0];

      const retrieved = await store.getEventById(event.eventId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.eventId).toBe(event.eventId);
    });

    it('should get events by aggregate ID', async () => {
      const events = await store.getEventsByAggregateId('goal-123');

      expect(events).toHaveLength(1);
      expect(events[0].aggregateId).toBe('goal-123');
    });

    it('should query events by criteria', async () => {
      const events = await store.query({ eventType: 'GoalCreated' });

      expect(events).toHaveLength(2);
      expect(events.every((e) => e.eventType === 'GoalCreated')).toBe(true);
    });

    it('should query by correlation ID', async () => {
      const events = await store.query({ correlationId: 'correlation-1' });

      expect(events).toHaveLength(2);
    });

    it('should support pagination', async () => {
      const page1 = await store.query({ limit: 2, offset: 0 });
      const page2 = await store.query({ limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(1);
    });

    it('should get all events in order', async () => {
      const events = await store.getAllEvents();

      expect(events).toHaveLength(3);
      expect(events[0].eventType).toBe('UserOnboarded');
      expect(events[1].eventType).toBe('GoalCreated');
      expect(events[2].eventType).toBe('GoalCreated');
    });

    it('should count events by aggregate', async () => {
      const count = await store.getEventCountByAggregateId('goal-123');

      expect(count).toBe(1);
    });

    it('should support replay (get events from sequence)', async () => {
      const allEvents = await store.getAllEvents();
      expect(allEvents).toHaveLength(3);

      // Replay from sequence 2 (skip first event)
      const replayedEvents = await store.getAllEvents(1, 10);

      expect(replayedEvents).toHaveLength(2);
      expect(replayedEvents[0].eventType).toBe('GoalCreated');
    });
  });

  describe('Event validation', () => {
    it('should reject invalid events on append', async () => {
      const invalidEvent = new DomainEventBuilder('UserOnboarded', 'learner-123', 'Learner')
        .setTenantId('') // Missing tenant ID
        .setData({})
        .build();

      await expect(store.append(invalidEvent)).rejects.toThrow();
    });
  });

  describe('Archival', () => {
    it('should support archival (no-op in memory)', async () => {
      const event = new DomainEventBuilder('UserOnboarded', 'learner-123', 'Learner')
        .setTenantId('tenant-1')
        .setData({})
        .build();

      await store.append(event);

      const archived = await store.archiveEventsBefore(new Date().toISOString());

      // In-memory store is no-op, returns 0
      expect(archived).toBe(0);
      // Event still available
      expect(await store.count()).toBe(1);
    });
  });

  describe('Health check', () => {
    it('should report healthy', async () => {
      const health = await store.health();
      expect(health).toBe(true);
    });
  });
});
