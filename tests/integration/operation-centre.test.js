/**
 * Operation Centre Integration Tests
 * Tests for real-time dashboard, WebSocket delivery, and control actions
 */

const ConfigLoader = require('../../src/config/config-loader');
const AgentRegistry = require('../../src/agents/agent-registry');
const ProviderRegistry = require('../../src/providers/provider-registry');
const AlphaOrchestratorV2 = require('../../src/core/alpha-orchestrator-v2');
const OperationCentre = require('../../src/operation-centre/operation-centre');
const EventAggregator = require('../../src/operation-centre/event-aggregator');
const http = require('http');

describe('Operation Centre', () => {
  let loader, agentRegistry, providerRegistry, alpha, operationCentre, httpServer;

  beforeEach(() => {
    loader = new ConfigLoader('config');
    const config = loader.loadAll();

    agentRegistry = new AgentRegistry();
    providerRegistry = new ProviderRegistry();

    agentRegistry.registerAgents(config.agents);
    providerRegistry.registerProviders(config.providers);

    alpha = new AlphaOrchestratorV2(agentRegistry, providerRegistry);

    httpServer = http.createServer();
    operationCentre = new OperationCentre(
      httpServer,
      alpha,
      agentRegistry,
      providerRegistry
    );
  });

  describe('Event Aggregator', () => {
    test('should record events', () => {
      const aggregator = new EventAggregator();

      const event = aggregator.recordEvent({
        type: 'test.event',
        agent: 'Alpha',
        agent_code: 'AA',
        status: 'completed'
      });

      expect(event).toBeDefined();
      expect(event.type).toBe('test.event');
      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
    });

    test('should maintain event history', () => {
      const aggregator = new EventAggregator();

      for (let i = 0; i < 50; i++) {
        aggregator.recordEvent({
          type: `event.${i}`,
          agent: 'Alpha',
          status: 'completed'
        });
      }

      const recent = aggregator.getRecentEvents(20);
      expect(recent.length).toBe(20);
      expect(recent[recent.length - 1].type).toContain('event.');
    });

    test('should update state from events', () => {
      const aggregator = new EventAggregator();

      aggregator.recordEvent({
        type: 'agent.status_changed',
        agent: 'Charlie',
        agent_code: 'CC',
        status: 'working'
      });

      const state = aggregator.getAgentState('CC');
      expect(state).toBeDefined();
      expect(state.status).toBe('working');
    });

    test('should filter events by type', () => {
      const aggregator = new EventAggregator();

      aggregator.recordEvent({
        type: 'objective.received',
        agent: 'Alpha',
        status: 'completed'
      });

      aggregator.recordEvent({
        type: 'task.completed',
        agent: 'Bravo',
        status: 'completed'
      });

      aggregator.recordEvent({
        type: 'objective.received',
        agent: 'Alpha',
        status: 'completed'
      });

      const filtered = aggregator.getRecentEvents(10, {
        types: ['objective.received']
      });

      expect(filtered.length).toBe(2);
      expect(filtered.every(e => e.type === 'objective.received')).toBe(true);
    });

    test('should filter events by agent', () => {
      const aggregator = new EventAggregator();

      aggregator.recordEvent({
        type: 'agent.executed',
        agent_code: 'CC',
        status: 'completed'
      });

      aggregator.recordEvent({
        type: 'agent.executed',
        agent_code: 'DD',
        status: 'completed'
      });

      const filtered = aggregator.getRecentEvents(10, {
        agent_codes: ['CC']
      });

      expect(filtered.every(e => e.agent_code === 'CC')).toBe(true);
    });
  });

  describe('Operation Centre', () => {
    test('should initialize', () => {
      expect(operationCentre).toBeDefined();
      expect(operationCentre.eventAggregator).toBeDefined();
      expect(operationCentre.eventStream).toBeDefined();
    });

    test('should record control actions', async () => {
      const result = await operationCentre.recordControlAction(
        'pause',
        'user123',
        { objective_id: 'obj-123' }
      );

      expect(result).toBeDefined();
      expect(result.type).toBe('control.pause');
      expect(result.user_id).toBe('user123');
    });

    test('should request authorization', async () => {
      const request = await operationCentre.requestAuthorization(
        'publish_course',
        'Tango',
        'User requested course publication'
      );

      expect(request).toBeDefined();
      expect(request.id).toBeDefined();
      expect(request.status).toBe('pending');
      expect(request.risk_level).toBe('high'); // publish is high risk
    });

    test('should approve authorization', async () => {
      const request = await operationCentre.requestAuthorization(
        'generate_image',
        'Foxtrot',
        'Generate promotional image'
      );

      const approved = await operationCentre.approveAuthorization(
        request.id,
        'approver123'
      );

      expect(approved.status).toBe('approved');
      expect(approved.approvals.length).toBe(1);
      expect(approved.approvals[0].approver_id).toBe('approver123');
    });

    test('should deny authorization', async () => {
      const request = await operationCentre.requestAuthorization(
        'delete_content',
        'Delta',
        'Delete old courses'
      );

      const denied = await operationCentre.denyAuthorization(
        request.id,
        'Not approved for deletion',
        'reviewer456'
      );

      expect(denied.status).toBe('denied');
      expect(denied.denial_reason).toBe('Not approved for deletion');
      expect(denied.denier_id).toBe('reviewer456');
    });

    test('should get pending authorizations', async () => {
      await operationCentre.requestAuthorization(
        'action1',
        'Agent1',
        'Reason 1'
      );

      await operationCentre.requestAuthorization(
        'action2',
        'Agent2',
        'Reason 2'
      );

      const pending = operationCentre.getPendingAuthorizations();
      expect(pending.length).toBeGreaterThanOrEqual(2);
      expect(pending.every(p => p.status === 'pending')).toBe(true);
    });

    test('should assess risk levels', async () => {
      const highRisk = await operationCentre.requestAuthorization(
        'voice_clone', 'Sierra', 'Clone voice'
      );
      expect(highRisk.risk_level).toBe('high');

      const mediumRisk = await operationCentre.requestAuthorization(
        'generate_video', 'Foxtrot', 'Generate video'
      );
      expect(mediumRisk.risk_level).toBe('medium');

      const lowRisk = await operationCentre.requestAuthorization(
        'read_data', 'Oscar', 'Read analytics'
      );
      expect(lowRisk.risk_level).toBe('low');
    });

    test('should pause objective', async () => {
      const result = await operationCentre.pauseObjective(
        'obj-123',
        'user@example.com'
      );

      expect(result.status).toBe('paused');
      expect(result.objective_id).toBe('obj-123');
    });

    test('should resume objective', async () => {
      const result = await operationCentre.resumeObjective(
        'obj-123',
        'user@example.com'
      );

      expect(result.status).toBe('resumed');
      expect(result.objective_id).toBe('obj-123');
    });

    test('should cancel objective', async () => {
      const result = await operationCentre.cancelObjective(
        'obj-123',
        'user@example.com',
        'User requested cancellation'
      );

      expect(result.status).toBe('cancelled');
      expect(result.objective_id).toBe('obj-123');
    });

    test('should get dashboard state', () => {
      const state = operationCentre.getDashboardState();

      expect(state).toBeDefined();
      expect(state.timestamp).toBeDefined();
      expect(state.orchestrator).toBeDefined();
      expect(state.agents).toBeDefined();
      expect(state.authorizations).toBeDefined();
      expect(state.system_health).toBeDefined();
    });

    test('should get agents status', () => {
      const agents = operationCentre.getAgentsStatus();

      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBeGreaterThan(0);

      // Check that we have all NATO agents
      const codes = agents.map(a => a.code);
      expect(codes).toContain('AA'); // Alpha
      expect(codes).toContain('BB'); // Bravo
      expect(codes).toContain('CC'); // Charlie
    });

    test('should get system health', () => {
      const health = operationCentre.getSystemHealth();

      expect(health.status).toBe('healthy');
      expect(health.orchestration_service).toBeDefined();
      expect(health.audit_service).toBeDefined();
      expect(health.event_stream).toBeDefined();
      expect(health.uptime_seconds).toBeGreaterThan(0);
    });

    test('should get control history', async () => {
      await operationCentre.recordControlAction('pause', 'user1', {});
      await operationCentre.recordControlAction('resume', 'user1', {});
      await operationCentre.recordControlAction('cancel', 'user1', {});

      const history = operationCentre.getControlHistory();
      expect(history.length).toBeGreaterThanOrEqual(3);
    });

    test('should get recent events', async () => {
      operationCentre.eventAggregator.recordEvent({
        type: 'test.event',
        agent: 'Alpha',
        status: 'completed'
      });

      const recent = operationCentre.getRecentEvents(10);
      expect(recent.length).toBeGreaterThan(0);
    });

    test('should get connection info', () => {
      const info = operationCentre.getConnectionInfo();

      expect(info).toBeDefined();
      expect(info.connected_clients).toBeGreaterThanOrEqual(0);
      expect(info.clients).toBeDefined();
      expect(Array.isArray(info.clients)).toBe(true);
    });
  });

  describe('Phase 1 & 2 Compatibility', () => {
    test('should maintain Alpha orchestrator functionality', async () => {
      const response = await alpha.receiveObjective({
        description: 'Test objective',
        user_id: 'user123'
      });

      expect(response).toBeDefined();
      expect(response.objective_id).toBeDefined();
      expect(response.task_id).toBeDefined();
      expect(response.status).toBe('planned');
    });

    test('should maintain agent registry', () => {
      const agents = agentRegistry.getEnabledAgents();
      expect(agents.length).toBeGreaterThan(0);
      expect(agents.map(a => a.code)).toContain('AA');
    });

    test('should maintain provider registry', () => {
      const status = providerRegistry.getStatus();
      expect(status).toBeDefined();
      expect(status.total_providers).toBeGreaterThan(0);
    });

    test('should create audit events through orchestrator', async () => {
      await alpha.receiveObjective({
        description: 'Test with audit',
        user_id: 'user123'
      });

      expect(alpha.auditLog.length).toBeGreaterThan(0);
    });
  });

  describe('Security', () => {
    test('should not expose sensitive data in dashboard state', () => {
      const state = operationCentre.getDashboardState();

      // Convert to JSON and check for secrets
      const stateStr = JSON.stringify(state);

      // Should not contain common secrets
      expect(stateStr).not.toContain('password');
      expect(stateStr).not.toContain('secret');
      expect(stateStr).not.toContain('api_key');
      expect(stateStr).not.toContain('token');
    });

    test('should record authorization in audit trail', async () => {
      const request = await operationCentre.requestAuthorization(
        'test_action',
        'TestAgent',
        'Test reason'
      );

      const recentEvents = operationCentre.getRecentEvents(50);
      const authEvent = recentEvents.find(e => e.type === 'authorization.requested');

      expect(authEvent).toBeDefined();
      expect(authEvent.details.request_id).toBe(request.id);
    });

    test('should record control actions in audit trail', async () => {
      await operationCentre.recordControlAction(
        'test_control',
        'test_user',
        { objective_id: 'test_obj' }
      );

      const recentEvents = operationCentre.getRecentEvents(50);
      const controlEvent = recentEvents.find(e => e.type === 'control.test_control');

      expect(controlEvent).toBeDefined();
      expect(controlEvent.details.user_id).toBe('test_user');
    });
  });

  describe('Error Handling', () => {
    test('should handle missing authorization request', async () => {
      const request = operationCentre.getAuthorizationRequest('nonexistent');
      expect(request).toBeUndefined();
    });

    test('should handle invalid risk assessment', () => {
      // Should not throw, should return 'low' for unknown action
      const request = operationCentre.assessRiskLevel('completely_unknown_action_xyz');
      expect(request).toBe('low');
    });
  });
});
