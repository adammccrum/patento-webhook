const { AuditEvent, AUDIT_EVENT_TYPES } = require('../../src/audit/audit-event-schema');

describe('AuditEvent', () => {
  test('should create an audit event', () => {
    const event = new AuditEvent({
      event_type: AUDIT_EVENT_TYPES.AGENT_EXECUTED,
      agent: 'Alpha',
      agent_code: 'AA',
      action: 'task-routing',
      status: 'completed'
    });

    expect(event.id).toBeDefined();
    expect(event.timestamp).toBeDefined();
    expect(event.event_type).toBe(AUDIT_EVENT_TYPES.AGENT_EXECUTED);
  });

  test('should validate audit event', () => {
    const validData = {
      event_type: 'test',
      agent: 'Test',
      action: 'test',
      status: 'completed'
    };

    const validation = AuditEvent.validate(validData);
    expect(validation.valid).toBe(true);
  });

  test('should fail validation for missing fields', () => {
    const invalidData = {
      agent: 'Test',
      action: 'test'
    };

    const validation = AuditEvent.validate(invalidData);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  test('should fail validation for invalid status', () => {
    const invalidData = {
      event_type: 'test',
      agent: 'Test',
      action: 'test',
      status: 'invalid'
    };

    const validation = AuditEvent.validate(invalidData);
    expect(validation.valid).toBe(false);
  });

  test('should serialize to JSON', () => {
    const event = new AuditEvent({
      event_type: AUDIT_EVENT_TYPES.AGENT_EXECUTED,
      agent: 'Echo',
      agent_code: 'EE',
      action: 'text-to-speech',
      status: 'completed',
      cost: 0.5,
      provider_used: 'voicebox'
    });

    const json = event.toJSON();
    expect(json.event_type).toBe(AUDIT_EVENT_TYPES.AGENT_EXECUTED);
    expect(json.cost).toBe(0.5);
    expect(json.provider_used).toBe('voicebox');
  });
});
