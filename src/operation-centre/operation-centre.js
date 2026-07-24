/**
 * Operation Centre - Main service for real-time dashboard
 * Coordinates event aggregation, WebSocket delivery, and state management
 */

const logger = require('../utils/logger');
const EventAggregator = require('./event-aggregator');
const EventStream = require('./event-stream');

class OperationCentre {
  constructor(httpServer, alpha, agentRegistry, providerRegistry) {
    this.httpServer = httpServer;
    this.alpha = alpha;
    this.agentRegistry = agentRegistry;
    this.providerRegistry = providerRegistry;

    this.eventAggregator = new EventAggregator();
    this.eventStream = new EventStream(httpServer, this.eventAggregator);

    this.controlHistory = []; // Log of all control actions
    this.authorizationRequests = new Map(); // requestId -> request
    this.maxControlHistorySize = 500;

    // Hook into Alpha's audit events
    this.hookAlphaEvents();
  }

  /**
   * Initialize Operation Centre (start WebSocket server)
   */
  initialize() {
    this.eventStream.initialize();
    logger.info('Operation Centre initialized');
  }

  /**
   * Hook into Alpha orchestrator's audit events
   */
  hookAlphaEvents() {
    if (this.alpha.on) {
      this.alpha.on('audit_event', (event) => {
        this.recordOrchestratorEvent(event);
      });
    }
  }

  /**
   * Record event from orchestrator
   */
  recordOrchestratorEvent(event) {
    const operationEvent = {
      id: event.id,
      timestamp: event.timestamp || new Date().toISOString(),
      type: this.mapAuditTypeToEventType(event.event_type),
      agent: event.agent,
      agent_code: event.agent_code,
      objective_id: event.details?.objective_id,
      task_id: event.details?.task_id,
      subtask_id: event.details?.subtask_id,
      action: event.action,
      status: event.status,
      details: event.details || {},
      error: event.error
    };

    this.eventAggregator.recordEvent(operationEvent);
  }

  /**
   * Map audit event types to operation centre event types
   */
  mapAuditTypeToEventType(auditType) {
    const mapping = {
      'objective_received': 'objective.received',
      'task_planned': 'task.planned',
      'task_completed': 'task.completed',
      'task_failed': 'task.failed',
      'agent_executed': 'agent.executed',
      'agent_failed': 'agent.failed',
      'action_escalated': 'authorization.requested'
    };

    return mapping[auditType] || `audit.${auditType}`;
  }

  /**
   * Record control action (pause, resume, cancel, etc.)
   */
  async recordControlAction(action, userId, context = {}) {
    const controlAction = {
      id: require('uuid').v4(),
      timestamp: new Date().toISOString(),
      type: `control.${action}`,
      user_id: userId,
      context,
      status: 'recorded'
    };

    this.controlHistory.push(controlAction);
    if (this.controlHistory.length > this.maxControlHistorySize) {
      this.controlHistory.shift();
    }

    // Broadcast to all clients
    this.eventAggregator.recordEvent({
      type: controlAction.type,
      action: action,
      status: 'recorded',
      details: {
        user_id: userId,
        ...context
      }
    });

    logger.info(`Control action recorded: ${action} by ${userId}`);
    return controlAction;
  }

  /**
   * Request authorization for restricted action
   */
  async requestAuthorization(action, agent, reason, context = {}) {
    const request = {
      id: require('uuid').v4(),
      timestamp: new Date().toISOString(),
      action: action,
      agent: agent,
      reason: reason,
      context: context,
      status: 'pending',
      risk_level: this.assessRiskLevel(action),
      approvals: []
    };

    this.authorizationRequests.set(request.id, request);

    // Broadcast authorization request
    this.eventAggregator.recordEvent({
      type: 'authorization.requested',
      action: action,
      agent: agent,
      status: 'pending',
      details: {
        request_id: request.id,
        reason: reason,
        risk_level: request.risk_level
      }
    });

    logger.info(`Authorization requested: ${action} by ${agent} (${request.id})`);
    return request;
  }

  /**
   * Assess risk level of an action
   */
  assessRiskLevel(action) {
    const highRiskActions = [
      'publish', 'deploy', 'delete', 'override',
      'voice_clone', 'data_export', 'system_config'
    ];

    const mediumRiskActions = [
      'generate_media', 'generate_video', 'create_content'
    ];

    for (const risk of highRiskActions) {
      if (action.includes(risk)) return 'high';
    }

    for (const risk of mediumRiskActions) {
      if (action.includes(risk)) return 'medium';
    }

    return 'low';
  }

  /**
   * Approve authorization request
   */
  async approveAuthorization(requestId, approverId) {
    const request = this.authorizationRequests.get(requestId);
    if (!request) {
      throw new Error(`Authorization request ${requestId} not found`);
    }

    request.status = 'approved';
    request.approvals.push({
      approver_id: approverId,
      timestamp: new Date().toISOString()
    });

    this.eventAggregator.recordEvent({
      type: 'authorization.approved',
      action: request.action,
      status: 'approved',
      details: {
        request_id: requestId,
        approver_id: approverId
      }
    });

    logger.info(`Authorization approved: ${requestId} by ${approverId}`);
    return request;
  }

  /**
   * Deny authorization request
   */
  async denyAuthorization(requestId, denialReason, denierId) {
    const request = this.authorizationRequests.get(requestId);
    if (!request) {
      throw new Error(`Authorization request ${requestId} not found`);
    }

    request.status = 'denied';
    request.denial_reason = denialReason;
    request.denier_id = denierId;
    request.denial_timestamp = new Date().toISOString();

    this.eventAggregator.recordEvent({
      type: 'authorization.denied',
      action: request.action,
      status: 'denied',
      details: {
        request_id: requestId,
        reason: denialReason,
        denier_id: denierId
      }
    });

    logger.info(`Authorization denied: ${requestId} by ${denierId}`);
    return request;
  }

  /**
   * Get pending authorizations
   */
  getPendingAuthorizations() {
    return Array.from(this.authorizationRequests.values())
      .filter(r => r.status === 'pending');
  }

  /**
   * Get authorization request
   */
  getAuthorizationRequest(requestId) {
    return this.authorizationRequests.get(requestId);
  }

  /**
   * Pause objective execution
   */
  async pauseObjective(objectiveId, userId) {
    await this.recordControlAction('pause', userId, {
      objective_id: objectiveId
    });

    // TODO: Implement actual pause logic
    return { status: 'paused', objective_id: objectiveId };
  }

  /**
   * Resume objective execution
   */
  async resumeObjective(objectiveId, userId) {
    await this.recordControlAction('resume', userId, {
      objective_id: objectiveId
    });

    // TODO: Implement actual resume logic
    return { status: 'resumed', objective_id: objectiveId };
  }

  /**
   * Cancel objective
   */
  async cancelObjective(objectiveId, userId, reason = '') {
    await this.recordControlAction('cancel', userId, {
      objective_id: objectiveId,
      reason: reason
    });

    // TODO: Implement actual cancel logic
    return { status: 'cancelled', objective_id: objectiveId };
  }

  /**
   * Get dashboard state snapshot
   */
  getDashboardState() {
    return {
      timestamp: new Date().toISOString(),
      orchestrator: {
        name: this.alpha?.name || 'Alpha',
        code: this.alpha?.code || 'AA',
        status: 'active'
      },
      agents: this.getAgentsStatus(),
      objectives: this.getObjectivesStatus(),
      tasks: this.getTasksStatus(),
      authorizations: this.getPendingAuthorizations(),
      system_health: this.getSystemHealth(),
      connected_clients: this.eventStream.getConnectedClientCount()
    };
  }

  /**
   * Get all agents status
   */
  getAgentsStatus() {
    const agents = this.agentRegistry.getEnabledAgents();
    return agents.map(agent => {
      const status = this.agentRegistry.getStatus(agent.code);
      const agentState = this.eventAggregator.getAgentState(agent.code);

      return {
        code: agent.code,
        name: agent.name,
        role: agent.role,
        status: status?.currentStatus || 'idle',
        current_task: agentState?.current_task,
        current_action: agentState?.current_action,
        last_event: agentState?.last_event,
        last_event_time: agentState?.last_event_time,
        health_status: 'healthy',
        enabled: agent.enabled,
        runtime: 'mocked' // Phase 3: mocked implementation
      };
    });
  }

  /**
   * Get objectives status
   */
  getObjectivesStatus() {
    const objectives = this.eventAggregator.objectiveState;
    return Array.from(objectives.values()).map(obj => ({
      objective_id: obj.objective_id,
      status: obj.status,
      last_event: obj.last_event,
      last_event_time: obj.last_event_time
    }));
  }

  /**
   * Get tasks status
   */
  getTasksStatus() {
    const tasks = this.eventAggregator.taskState;
    return Array.from(tasks.values()).slice(0, 50).map(task => ({
      task_id: task.task_id,
      status: task.status,
      last_event: task.last_event,
      last_event_time: task.last_event_time,
      current_action: task.current_action
    }));
  }

  /**
   * Get system health
   */
  getSystemHealth() {
    return {
      status: 'healthy',
      orchestration_service: 'operational',
      audit_service: 'operational',
      event_stream: 'operational',
      agent_registry: 'operational',
      provider_registry: 'operational',
      uptime_seconds: process.uptime(),
      last_health_check: new Date().toISOString()
    };
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit = 50, filters = {}) {
    return this.eventAggregator.getRecentEvents(limit, filters);
  }

  /**
   * Get control action history
   */
  getControlHistory(limit = 50) {
    return this.controlHistory.slice(-limit);
  }

  /**
   * Get WebSocket connection info
   */
  getConnectionInfo() {
    return {
      connected_clients: this.eventStream.getConnectedClientCount(),
      clients: this.eventStream.getAllClientsInfo(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('Shutting down Operation Centre...');
    if (this.eventStream) {
      this.eventStream.shutdown();
    }
    logger.info('Operation Centre shutdown complete');
  }
}

module.exports = OperationCentre;
