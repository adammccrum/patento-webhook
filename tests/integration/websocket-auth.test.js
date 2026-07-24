/**
 * WebSocket Authentication Tests - Phase 4D
 * Tests WebSocket connection security, authentication, and RBAC enforcement
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const EventStream = require('../../src/operation-centre/event-stream');
const EventAggregator = require('../../src/operation-centre/event-aggregator');
const authService = require('../../src/auth/auth-service');
const rbacEngine = require('../../src/authorization/rbac-engine');
const http = require('http');

describe('WebSocket Authentication and Authorization - Phase 4D', () => {
  let server;
  let eventStream;
  let eventAggregator;
  let wss;
  let testUser;
  let testToken;

  beforeAll((done) => {
    server = http.createServer();
    eventAggregator = new EventAggregator();
    eventStream = new EventStream(server, eventAggregator);
    wss = eventStream.initialize();

    server.listen(9001, () => {
      done();
    });
  });

  beforeEach(() => {
    testUser = {
      id: 'test-user-123',
      email: 'test@example.com',
      type: 'user'
    };
    testToken = jwt.sign(
      {
        sub: testUser.id,
        email: testUser.email,
        type: testUser.type
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '15m', issuer: 'patento-orchestration' }
    );
  });

  afterAll((done) => {
    if (wss) wss.close();
    if (server) server.close(done);
  });

  describe('Connection Authentication', () => {
    test('should reject connection without token', (done) => {
      const ws = new WebSocket('ws://localhost:9001/ws/events');

      ws.on('error', (error) => {
        expect(error).toBeDefined();
        done();
      });

      ws.on('open', () => {
        ws.close();
        done(new Error('Should not accept connection without token'));
      });
    });

    test('should reject connection with invalid token', (done) => {
      const invalidToken = 'invalid.token.here';
      const ws = new WebSocket(`ws://localhost:9001/ws/events?token=${encodeURIComponent(invalidToken)}`);

      ws.on('error', (error) => {
        expect(error).toBeDefined();
        done();
      });

      ws.on('open', () => {
        ws.close();
        done(new Error('Should not accept connection with invalid token'));
      });
    });

    test('should accept connection with valid token', (done) => {
      const ws = new WebSocket(`ws://localhost:9001/ws/events?token=${encodeURIComponent(testToken)}`);

      ws.on('open', () => {
        ws.close();
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    test('should reject expired token', (done) => {
      const expiredToken = jwt.sign(
        {
          sub: testUser.id,
          email: testUser.email,
          type: testUser.type
        },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h', issuer: 'patento-orchestration' }
      );

      const ws = new WebSocket(`ws://localhost:9001/ws/events?token=${encodeURIComponent(expiredToken)}`);

      ws.on('error', (error) => {
        expect(error).toBeDefined();
        done();
      });

      ws.on('open', () => {
        ws.close();
        done(new Error('Should not accept expired token'));
      });
    });
  });

  describe('Message Handling', () => {
    test('should reject messages exceeding size limit (64KB)', (done) => {
      const ws = new WebSocket(`ws://localhost:9001/ws/events?token=${encodeURIComponent(testToken)}`);

      ws.on('open', () => {
        const largeMessage = 'x'.repeat(65537);
        ws.send(largeMessage);

        ws.on('message', (data) => {
          const response = JSON.parse(data);
          if (response.error && response.error.includes('too large')) {
            ws.close();
            done();
          }
        });
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    test('should handle ping/pong heartbeat', (done) => {
      const ws = new WebSocket(`ws://localhost:9001/ws/events?token=${encodeURIComponent(testToken)}`);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'ping' }));
      });

      ws.on('message', (data) => {
        const response = JSON.parse(data);
        if (response.type === 'pong') {
          ws.close();
          done();
        }
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    test('should reject invalid JSON messages', (done) => {
      const ws = new WebSocket(`ws://localhost:9001/ws/events?token=${encodeURIComponent(testToken)}`);

      ws.on('open', () => {
        ws.send('{ invalid json }');
      });

      ws.on('message', (data) => {
        const response = JSON.parse(data);
        if (response.type === 'error' && response.error.includes('Invalid message format')) {
          ws.close();
          done();
        }
      });

      ws.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('Subscription Management', () => {
    test('should handle subscribe message', (done) => {
      const ws = new WebSocket(`ws://localhost:9001/ws/events?token=${encodeURIComponent(testToken)}`);

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'subscribe',
          filters: { objective: true }
        }));
      });

      ws.on('message', (data) => {
        const response = JSON.parse(data);
        if (response.type === 'recent_events') {
          ws.close();
          done();
        }
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    test('should handle unsubscribe message', (done) => {
      const ws = new WebSocket(`ws://localhost:9001/ws/events?token=${encodeURIComponent(testToken)}`);

      let subscribed = false;

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'subscribe',
          filters: { objective: true }
        }));
      });

      ws.on('message', (data) => {
        const response = JSON.parse(data);
        if (response.type === 'recent_events' && !subscribed) {
          subscribed = true;
          ws.send(JSON.stringify({ type: 'unsubscribe' }));
        } else if (response.type === 'unsubscribed') {
          ws.close();
          done();
        }
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    test('should limit subscriptions per connection', (done) => {
      const ws = new WebSocket(`ws://localhost:9001/ws/events?token=${encodeURIComponent(testToken)}`);

      ws.on('open', () => {
        // Try to exceed subscription limit
        for (let i = 0; i < 10; i++) {
          ws.send(JSON.stringify({
            type: 'subscribe',
            filters: { agent: true }
          }));
        }
      });

      let errorCount = 0;
      ws.on('message', (data) => {
        const response = JSON.parse(data);
        if (response.error && response.error.includes('Too many subscriptions')) {
          errorCount++;
          if (errorCount >= 1) {
            ws.close();
            expect(errorCount).toBeGreaterThan(0);
            done();
          }
        }
      });

      ws.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('State Snapshot Handling', () => {
    test('should handle state snapshot request', (done) => {
      const ws = new WebSocket(`ws://localhost:9001/ws/events?token=${encodeURIComponent(testToken)}`);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'get_state_snapshot' }));
      });

      ws.on('message', (data) => {
        const response = JSON.parse(data);
        if (response.type === 'state_snapshot') {
          expect(response.data).toBeDefined();
          ws.close();
          done();
        }
      });

      ws.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('Connection Lifecycle', () => {
    test('should track connection duration', (done) => {
      const ws = new WebSocket(`ws://localhost:9001/ws/events?token=${encodeURIComponent(testToken)}`);

      const startTime = Date.now();

      setTimeout(() => {
        ws.close();
      }, 100);

      ws.on('close', () => {
        const duration = Date.now() - startTime;
        expect(duration).toBeGreaterThan(50);
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    test('should properly clean up disconnected clients', (done) => {
      const ws = new WebSocket(`ws://localhost:9001/ws/events?token=${encodeURIComponent(testToken)}`);

      ws.on('open', () => {
        const initialCount = eventStream.getConnectedClientCount();
        expect(initialCount).toBeGreaterThan(0);
        ws.close();
      });

      ws.on('close', () => {
        // Give it a moment to cleanup
        setTimeout(() => {
          done();
        }, 100);
      });

      ws.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('Origin Validation', () => {
    test('should validate CORS origin', () => {
      const testOrigins = [
        'http://localhost:3000',
        'https://example.com',
        null
      ];

      testOrigins.forEach(origin => {
        const isAllowed = eventStream.isOriginAllowed(origin);
        // Localhost should always be allowed in development
        if (origin && origin.includes('localhost')) {
          expect(isAllowed).toBe(true);
        }
      });
    });
  });
});
