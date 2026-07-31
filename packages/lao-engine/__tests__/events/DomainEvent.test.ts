import { describe, it, expect, beforeEach } from 'vitest';
import { DomainEvent, DomainEventBuilder, validateEvent } from '../../src/events/DomainEvent';

describe('DomainEvent', () => {
  describe('DomainEventBuilder', () => {
    it('should create a valid event with all required fields', () => {
      const event = new DomainEventBuilder('UserOnboarded', 'learner-123', 'Learner', 'correlation-123')
        .setTenantId('tenant-1')
        .setData({ learnerId: 'learner-123', email: 'test@example.com' })
        .build();

      expect(event.eventType).toBe('UserOnboarded');
      expect(event.aggregateId).toBe('learner-123');
      expect(event.aggregateType).toBe('Learner');
      expect(event.tenantId).toBe('tenant-1');
      expect(event.data.learnerId).toBe('learner-123');
    });

    it('should generate unique eventIds', () => {
      const event1 = new DomainEventBuilder('UserOnboarded', 'learner-1', 'Learner')
        .setTenantId('tenant-1')
        .setData({})
        .build();

      const event2 = new DomainEventBuilder('UserOnboarded', 'learner-2', 'Learner')
        .setTenantId('tenant-1')
        .setData({})
        .build();

      expect(event1.eventId).not.toBe(event2.eventId);
    });

    it('should require tenantId', () => {
      expect(() => {
        new DomainEventBuilder('UserOnboarded', 'learner-123', 'Learner')
          .setData({ test: true })
          .build();
      }).toThrow('tenantId is required');
    });

    it('should require non-empty data', () => {
      expect(() => {
        new DomainEventBuilder('UserOnboarded', 'learner-123', 'Learner')
          .setTenantId('tenant-1')
          .build();
      }).toThrow('Event data cannot be empty');
    });

    it('should set causality chain', () => {
      const event = new DomainEventBuilder('GoalCreated', 'goal-123', 'Goal')
        .setTenantId('tenant-1')
        .setData({ goalId: 'goal-123' })
        .setCausalChain('user-123', 'clicked_create_goal', 'previous-event-123')
        .build();

      expect(event.causedByUserId).toBe('user-123');
      expect(event.causedByAction).toBe('clicked_create_goal');
      expect(event.causationId).toBe('previous-event-123');
    });

    it('should set source info', () => {
      const event = new DomainEventBuilder('UserOnboarded', 'learner-123', 'Learner')
        .setTenantId('tenant-1')
        .setData({})
        .setSourceInfo('LearnerService', '1.0.0')
        .build();

      expect(event.sourceName).toBe('LearnerService');
      expect(event.sourceVersion).toBe('1.0.0');
    });

    it('should set network info', () => {
      const event = new DomainEventBuilder('UserOnboarded', 'learner-123', 'Learner')
        .setTenantId('tenant-1')
        .setData({})
        .setNetworkInfo('Mozilla/5.0', '192.168.1.1')
        .build();

      expect(event.userAgent).toBe('Mozilla/5.0');
      expect(event.ipAddress).toBe('192.168.1.1');
    });
  });

  describe('validateEvent', () => {
    let validEvent: DomainEvent;

    beforeEach(() => {
      validEvent = new DomainEventBuilder('UserOnboarded', 'learner-123', 'Learner')
        .setTenantId('tenant-1')
        .setData({ test: true })
        .build();
    });

    it('should accept valid event', () => {
      expect(() => validateEvent(validEvent)).not.toThrow();
    });

    it('should reject event with missing eventId', () => {
      const invalidEvent = { ...validEvent, eventId: '' };
      expect(() => validateEvent(invalidEvent)).toThrow('Invalid eventId');
    });

    it('should reject event with missing aggregateId', () => {
      const invalidEvent = { ...validEvent, aggregateId: '' };
      expect(() => validateEvent(invalidEvent)).toThrow('Invalid aggregateId');
    });

    it('should reject event with invalid version', () => {
      const invalidEvent = { ...validEvent, version: 0 };
      expect(() => validateEvent(invalidEvent)).toThrow('Invalid version');
    });

    it('should reject event with empty data', () => {
      const invalidEvent = { ...validEvent, data: {} };
      expect(() => validateEvent(invalidEvent)).toThrow('Invalid data payload');
    });

    it('should reject event with missing tenantId', () => {
      const invalidEvent = { ...validEvent, tenantId: '' };
      expect(() => validateEvent(invalidEvent)).toThrow('Invalid tenantId');
    });
  });

  describe('Event immutability', () => {
    it('event should have readonly properties', () => {
      const event = new DomainEventBuilder('UserOnboarded', 'learner-123', 'Learner')
        .setTenantId('tenant-1')
        .setData({ test: true })
        .build();

      expect(() => {
        // @ts-ignore - intentionally testing immutability
        event.eventType = 'GoalCreated';
      }).toThrow();
    });
  });
});
