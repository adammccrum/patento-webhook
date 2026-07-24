/**
 * Audit Hash Chain Tests - Phase 4D
 * Tests cryptographic integrity of audit event chains
 */

const auditHashChain = require('../../src/audit/audit-hash-chain');

describe('Audit Hash Chain - Phase 4D', () => {
  describe('Event Hash Generation', () => {
    test('should generate deterministic hash for event', () => {
      const event = {
        id: 'event-123',
        timestamp: '2024-01-15T10:30:00Z',
        action: 'objective:created',
        actor: 'user-1',
        resource: 'objective-456'
      };

      const hash1 = auditHashChain.generateEventHash(event, null);
      const hash2 = auditHashChain.generateEventHash(event, null);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 hex is 64 chars
    });

    test('should include previous hash in computation', () => {
      const event = {
        id: 'event-123',
        timestamp: '2024-01-15T10:30:00Z',
        action: 'objective:created'
      };

      const hash1 = auditHashChain.generateEventHash(event, null);
      const hash2 = auditHashChain.generateEventHash(event, 'prev-hash-abc123');

      expect(hash1).not.toBe(hash2);
    });

    test('should produce different hash for different events', () => {
      const event1 = {
        id: 'event-123',
        timestamp: '2024-01-15T10:30:00Z',
        action: 'objective:created'
      };

      const event2 = {
        id: 'event-124',
        timestamp: '2024-01-15T10:30:01Z',
        action: 'objective:updated'
      };

      const hash1 = auditHashChain.generateEventHash(event1, null);
      const hash2 = auditHashChain.generateEventHash(event2, null);

      expect(hash1).not.toBe(hash2);
    });

    test('should detect modification of event data', () => {
      const event = {
        id: 'event-123',
        timestamp: '2024-01-15T10:30:00Z',
        action: 'objective:created',
        actor: 'user-1'
      };

      const originalHash = auditHashChain.generateEventHash(event, null);

      // Modify event
      event.action = 'objective:deleted';
      const modifiedHash = auditHashChain.generateEventHash(event, null);

      expect(originalHash).not.toBe(modifiedHash);
    });

    test('should use SHA256 algorithm', () => {
      const event = {
        id: 'test',
        action: 'test'
      };

      const hash = auditHashChain.generateEventHash(event, null);

      // SHA256 produces 64 character hex string
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Canonical Event Serialization', () => {
    test('should produce deterministic JSON', () => {
      const event = {
        z: 'last',
        a: 'first',
        m: 'middle'
      };

      const str1 = auditHashChain.canonicalEventString(event);
      const str2 = auditHashChain.canonicalEventString(event);

      expect(str1).toBe(str2);
    });

    test('should sort object keys consistently', () => {
      const event1 = { z: 1, a: 2, m: 3 };
      const event2 = { a: 2, m: 3, z: 1 };

      const str1 = auditHashChain.canonicalEventString(event1);
      const str2 = auditHashChain.canonicalEventString(event2);

      expect(str1).toBe(str2);
    });

    test('should handle nested objects', () => {
      const event = {
        user: { id: '123', email: 'test@example.com' },
        action: 'created'
      };

      const str = auditHashChain.canonicalEventString(event);

      expect(str).toBeDefined();
      expect(typeof str).toBe('string');
    });

    test('should be reversible for verification', () => {
      const event = {
        id: 'event-123',
        action: 'test'
      };

      const canonical = auditHashChain.canonicalEventString(event);
      const parsed = JSON.parse(canonical);

      expect(parsed).toEqual(event);
    });
  });

  describe('Hash Chain Verification', () => {
    test('should verify valid hash chain', () => {
      const event1 = { id: 'e1', action: 'a1' };
      const hash1 = auditHashChain.generateEventHash(event1, null);

      const event2 = { id: 'e2', action: 'a2' };
      const hash2 = auditHashChain.generateEventHash(event2, hash1);

      const event3 = { id: 'e3', action: 'a3' };
      const hash3 = auditHashChain.generateEventHash(event3, hash2);

      const events = [
        { ...event1, prev_hash: null, event_hash: hash1 },
        { ...event2, prev_hash: hash1, event_hash: hash2 },
        { ...event3, prev_hash: hash2, event_hash: hash3 }
      ];

      const result = auditHashChain.verifyHashChain(events);

      expect(result.valid).toBe(true);
      expect(result.tamperedIndices).toHaveLength(0);
    });

    test('should detect tampered events in chain', () => {
      const event1 = { id: 'e1', action: 'a1' };
      const hash1 = auditHashChain.generateEventHash(event1, null);

      const event2 = { id: 'e2', action: 'a2' };
      const hash2 = auditHashChain.generateEventHash(event2, hash1);

      const event3 = { id: 'e3', action: 'a3' };
      const hash3 = auditHashChain.generateEventHash(event3, hash2);

      // Tamper with event2
      const tamperedEvent2 = { ...event2, action: 'TAMPERED' };
      const tamperedHash2 = auditHashChain.generateEventHash(tamperedEvent2, hash1);

      const events = [
        { ...event1, prev_hash: null, event_hash: hash1 },
        { ...tamperedEvent2, prev_hash: hash1, event_hash: hash2 }, // Original hash but tampered data
        { ...event3, prev_hash: hash2, event_hash: hash3 }
      ];

      const result = auditHashChain.verifyHashChain(events);

      expect(result.valid).toBe(false);
      expect(result.tamperedIndices.length).toBeGreaterThan(0);
    });

    test('should detect missing link in chain', () => {
      const event1 = { id: 'e1', action: 'a1' };
      const hash1 = auditHashChain.generateEventHash(event1, null);

      const event2 = { id: 'e2', action: 'a2' };
      const hash2 = auditHashChain.generateEventHash(event2, 'wrong-prev-hash');

      const events = [
        { ...event1, prev_hash: null, event_hash: hash1 },
        { ...event2, prev_hash: 'wrong-prev-hash', event_hash: hash2 }
      ];

      const result = auditHashChain.verifyHashChain(events);

      expect(result.valid).toBe(false);
    });

    test('should verify first event has no prev_hash', () => {
      const event1 = { id: 'e1', action: 'a1' };
      const hash1 = auditHashChain.generateEventHash(event1, null);

      const events = [
        { ...event1, prev_hash: 'should-be-null', event_hash: hash1 }
      ];

      const result = auditHashChain.verifyHashChain(events);

      expect(result.valid).toBe(false);
    });
  });

  describe('Chain Statistics', () => {
    test('should calculate chain statistics', () => {
      const event1 = { id: 'e1', action: 'a1' };
      const hash1 = auditHashChain.generateEventHash(event1, null);

      const event2 = { id: 'e2', action: 'a2' };
      const hash2 = auditHashChain.generateEventHash(event2, hash1);

      const event3 = { id: 'e3', action: 'a3' };
      const hash3 = auditHashChain.generateEventHash(event3, hash2);

      const events = [
        { ...event1, prev_hash: null, event_hash: hash1 },
        { ...event2, prev_hash: hash1, event_hash: hash2 },
        { ...event3, prev_hash: hash2, event_hash: hash3 }
      ];

      const stats = auditHashChain.getHashChainStats(events);

      expect(stats.total_events).toBe(3);
      expect(stats.chain_valid).toBe(true);
      expect(stats.tampered_events).toBe(0);
    });
  });

  describe('Tampering Detection', () => {
    test('should report tampering when hash mismatch', () => {
      const event = { id: 'e1', action: 'test' };
      const expectedHash = 'expected-hash-123';
      const actualHash = 'actual-hash-456';

      const report = auditHashChain.reportTampering(event, expectedHash, actualHash);

      expect(report.tampered).toBe(true);
      expect(report.message).toContain('Tampering');
    });

    test('should log tampering evidence', () => {
      const event = {
        id: 'event-123',
        timestamp: '2024-01-15T10:30:00Z',
        action: 'test'
      };

      const report = auditHashChain.reportTampering(event, 'expected', 'actual');

      expect(report.timestamp).toBeDefined();
      expect(report.event_id).toBe('event-123');
      expect(report.expected_hash).toBe('expected');
      expect(report.actual_hash).toBe('actual');
    });
  });

  describe('Event Preparation', () => {
    test('should prepare event with hash chain fields', () => {
      const event = {
        timestamp: '2024-01-15T10:30:00Z',
        action: 'test',
        actor: 'user-1'
      };

      const prepared = auditHashChain.prepareAuditEvent(event, 1, null);

      expect(prepared.sequence).toBe(1);
      expect(prepared.prev_hash).toBeNull();
      expect(prepared.event_hash).toBeDefined();
      expect(prepared.timestamp).toBe(event.timestamp);
      expect(prepared.action).toBe(event.action);
    });

    test('should include previous hash in prepared event', () => {
      const event = { action: 'test' };
      const prevHash = 'previous-hash-abc';

      const prepared = auditHashChain.prepareAuditEvent(event, 2, prevHash);

      expect(prepared.sequence).toBe(2);
      expect(prepared.prev_hash).toBe(prevHash);
      expect(prepared.event_hash).toBeDefined();
    });
  });

  describe('Security Properties', () => {
    test('should be collision-resistant', () => {
      const hashes = new Set();

      for (let i = 0; i < 100; i++) {
        const event = { id: `e${i}`, action: `action${i}` };
        const hash = auditHashChain.generateEventHash(event, null);
        expect(hashes.has(hash)).toBe(false);
        hashes.add(hash);
      }

      expect(hashes.size).toBe(100); // All unique
    });

    test('should not allow hash reversal', () => {
      const event = {
        id: 'secret-123',
        action: 'classified-action'
      };

      const hash = auditHashChain.generateEventHash(event, null);

      // Hash should not reveal event data
      expect(hash).not.toContain('secret');
      expect(hash).not.toContain('classified');
    });
  });
});
