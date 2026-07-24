/**
 * Circuit Breaker Tests
 *
 * Tests all circuit breaker states, transitions, and error handling
 */

const CircuitBreaker = require('../../src/resilience/circuit-breaker');

describe('Circuit Breaker', () => {
  let breaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      name: 'test-breaker',
      failureThreshold: 3,
      successThreshold: 2,
      cooldownMs: 100
    });
  });

  describe('States', () => {
    it('starts in closed state', () => {
      expect(breaker.getState().state).toBe('closed');
      expect(breaker.getState().isClosed).toBe(true);
    });

    it('transitions from closed to open on threshold failures', () => {
      breaker.recordFailure({ classification: 'transient_error' });
      breaker.recordFailure({ classification: 'transient_error' });
      expect(breaker.getState().state).toBe('closed');

      breaker.recordFailure({ classification: 'transient_error' });
      expect(breaker.getState().state).toBe('open');
      expect(breaker.getState().isOpen).toBe(true);
    });

    it('open circuit fails fast', () => {
      breaker.recordFailure({ classification: 'transient_error' });
      breaker.recordFailure({ classification: 'transient_error' });
      breaker.recordFailure({ classification: 'transient_error' });

      expect(breaker.canExecute()).toBe(false);
    });

    it('transitions from open to half_open after cooldown', (done) => {
      // Open the circuit
      breaker.recordFailure({ classification: 'transient_error' });
      breaker.recordFailure({ classification: 'transient_error' });
      breaker.recordFailure({ classification: 'transient_error' });

      expect(breaker.getState().state).toBe('open');

      // Wait for cooldown
      setTimeout(() => {
        breaker.canExecute(); // Trigger state transition check
        expect(breaker.getState().state).toBe('half_open');
        expect(breaker.getState().isHalfOpen).toBe(true);
        done();
      }, 110);
    });

    it('half_open allows limited probes', () => {
      breaker.halfOpenProbeLimit = 1;
      breaker.state = 'half_open';

      expect(breaker.canExecute()).toBe(true);
      breaker.halfOpenProbeCount++;

      expect(breaker.canExecute()).toBe(false); // Probe limit exceeded
    });

    it('transitions from half_open to closed on success', () => {
      breaker.state = 'half_open';
      breaker.recordSuccess();
      breaker.recordSuccess();

      expect(breaker.getState().state).toBe('closed');
    });

    it('transitions from half_open to open on failure', () => {
      breaker.state = 'half_open';
      breaker.recordFailure({ classification: 'transient_error' });

      expect(breaker.getState().state).toBe('open');
    });

    it('disabled state bypasses all checks', () => {
      breaker.manualDisable();
      expect(breaker.getState().state).toBe('disabled');

      // Should allow execution regardless
      expect(breaker.canExecute()).toBe(true);
    });
  });

  describe('Error Classification', () => {
    it('ignores authorization failures', () => {
      breaker.recordFailure({ classification: 'authorization_failure' });
      breaker.recordFailure({ classification: 'authorization_failure' });
      breaker.recordFailure({ classification: 'authorization_failure' });

      // Should still be closed
      expect(breaker.getState().state).toBe('closed');
    });

    it('ignores permission denials', () => {
      breaker.recordFailure({ classification: 'permission_denial' });
      breaker.recordFailure({ classification: 'permission_denial' });
      breaker.recordFailure({ classification: 'permission_denial' });

      expect(breaker.getState().state).toBe('closed');
    });

    it('ignores policy denials', () => {
      breaker.recordFailure({ classification: 'policy_denial' });
      breaker.recordFailure({ classification: 'policy_denial' });
      breaker.recordFailure({ classification: 'policy_denial' });

      expect(breaker.getState().state).toBe('closed');
    });

    it('ignores cancellations', () => {
      breaker.recordFailure({ classification: 'cancellation' });
      breaker.recordFailure({ classification: 'cancellation' });
      breaker.recordFailure({ classification: 'cancellation' });

      expect(breaker.getState().state).toBe('closed');
    });

    it('counts transient errors', () => {
      breaker.recordFailure({ classification: 'transient_error' });
      breaker.recordFailure({ classification: 'transient_error' });
      breaker.recordFailure({ classification: 'transient_error' });

      expect(breaker.getState().state).toBe('open');
    });

    it('respects counted_error_classes configuration', () => {
      const custom = new CircuitBreaker({
        countedErrorClasses: ['custom_error'],
        ignoredErrorClasses: [],
        failureThreshold: 3
      });

      custom.recordFailure({ classification: 'transient_error' });
      custom.recordFailure({ classification: 'transient_error' });
      custom.recordFailure({ classification: 'transient_error' });

      // Should still be closed (transient_error not in counted list)
      expect(custom.getState().state).toBe('closed');

      custom.recordFailure({ classification: 'custom_error' });
      custom.recordFailure({ classification: 'custom_error' });
      custom.recordFailure({ classification: 'custom_error' });

      expect(custom.getState().state).toBe('open');
    });
  });

  describe('Manual Controls', () => {
    it('manual open bypasses normal operation', () => {
      expect(breaker.getState().state).toBe('closed');

      breaker.manualOpen();
      expect(breaker.getState().state).toBe('open');
      expect(breaker.canExecute()).toBe(false);
    });

    it('manual close resets to closed state', () => {
      breaker.manualOpen();
      expect(breaker.getState().state).toBe('open');

      breaker.manualClose();
      expect(breaker.getState().state).toBe('closed');
      expect(breaker.canExecute()).toBe(true);
    });

    it('manual disable bypasses all state checks', () => {
      breaker.manualDisable();

      // Even if we record many failures, circuit should be disabled
      for (let i = 0; i < 10; i++) {
        breaker.recordFailure({ classification: 'transient_error' });
      }

      expect(breaker.getState().state).toBe('disabled');
      expect(breaker.canExecute()).toBe(true);
    });
  });

  describe('State Transitions', () => {
    it('emits state change events', () => {
      const events = [];
      breaker.onStateChange = (event) => {
        events.push(event);
      };

      breaker.recordFailure({ classification: 'transient_error' });
      breaker.recordFailure({ classification: 'transient_error' });
      breaker.recordFailure({ classification: 'transient_error' });

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].newState).toBe('open');
    });

    it('emits resilience events', () => {
      const events = [];
      breaker.onEvent = (event) => {
        events.push(event);
      };

      breaker.recordFailure({ classification: 'transient_error' });
      breaker.recordFailure({ classification: 'transient_error' });
      breaker.recordFailure({ classification: 'transient_error' });

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toContain('resilience.circuit_open');
    });
  });

  describe('Reset', () => {
    it('resets counters and state', () => {
      breaker.recordFailure({ classification: 'transient_error' });
      breaker.recordFailure({ classification: 'transient_error' });
      breaker.recordFailure({ classification: 'transient_error' });

      expect(breaker.getState().state).toBe('open');

      breaker.reset();
      expect(breaker.getState().state).toBe('closed');
      expect(breaker.getState().failureCount).toBe(0);
    });
  });
});
