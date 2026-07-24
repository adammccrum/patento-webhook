/**
 * Dashboard API routes
 * Provides endpoints for the operation centre dashboard
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

module.exports = (operationCentre, agentRegistry, _providerRegistry) => {
  /**
   * GET /api/dashboard
   * Get complete dashboard state snapshot
   */
  router.get('/', (req, res) => {
    try {
      const state = operationCentre.getDashboardState();
      res.json(state);
    } catch (error) {
      logger.error(`Dashboard state error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/dashboard/agents
   * Get all agents with current status
   */
  router.get('/agents', (req, res) => {
    try {
      const agents = operationCentre.getAgentsStatus();
      res.json({
        timestamp: new Date().toISOString(),
        count: agents.length,
        agents
      });
    } catch (error) {
      logger.error(`Agents endpoint error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/dashboard/agents/:code
   * Get specific agent details
   */
  router.get('/agents/:code', (req, res) => {
    try {
      const agent = agentRegistry.getAgent(req.params.code);
      if (!agent) {
        return res.status(404).json({ error: `Agent ${req.params.code} not found` });
      }

      const status = agentRegistry.getStatus(req.params.code);
      const agentState = operationCentre.eventAggregator.getAgentState(req.params.code);

      res.json({
        agent: {
          code: agent.code,
          name: agent.name,
          role: agent.role,
          description: agent.description,
          capabilities: agent.capabilities,
          enabled: agent.enabled
        },
        status: {
          current_status: status?.currentStatus || 'idle',
          completed_tasks: status?.completedTasks || 0,
          failed_tasks: status?.failedTasks || 0,
          last_error: status?.lastError || null
        },
        state: agentState || {},
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Agent detail error for ${req.params.code}: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/dashboard/objectives
   * Get current objectives
   */
  router.get('/objectives', (req, res) => {
    try {
      const objectives = operationCentre.getObjectivesStatus();
      res.json({
        timestamp: new Date().toISOString(),
        count: objectives.length,
        objectives
      });
    } catch (error) {
      logger.error(`Objectives endpoint error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/dashboard/tasks
   * Get current tasks
   */
  router.get('/tasks', (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const tasks = operationCentre.getTasksStatus().slice(0, limit);
      res.json({
        timestamp: new Date().toISOString(),
        count: tasks.length,
        tasks
      });
    } catch (error) {
      logger.error(`Tasks endpoint error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/dashboard/events
   * Get recent events
   */
  router.get('/events', (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const eventType = req.query.type;
      const filters = {};

      if (eventType) {
        filters.types = [eventType];
      }

      const events = operationCentre.getRecentEvents(limit, filters);
      res.json({
        timestamp: new Date().toISOString(),
        count: events.length,
        events
      });
    } catch (error) {
      logger.error(`Events endpoint error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/dashboard/authorizations
   * Get pending authorizations
   */
  router.get('/authorizations', (req, res) => {
    try {
      const authorizations = operationCentre.getPendingAuthorizations();
      res.json({
        timestamp: new Date().toISOString(),
        count: authorizations.length,
        authorizations
      });
    } catch (error) {
      logger.error(`Authorizations endpoint error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/dashboard/authorizations/:id/approve
   * Approve authorization request
   */
  router.post('/authorizations/:id/approve', (req, res) => {
    try {
      const approverId = req.body.approver_id || 'system';
      const result = operationCentre.approveAuthorization(req.params.id, approverId);
      res.json({
        status: 'approved',
        authorization: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Approve error: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * POST /api/dashboard/authorizations/:id/deny
   * Deny authorization request
   */
  router.post('/authorizations/:id/deny', (req, res) => {
    try {
      const denierId = req.body.denier_id || 'system';
      const reason = req.body.reason || 'No reason provided';
      const result = operationCentre.denyAuthorization(
        req.params.id,
        reason,
        denierId
      );
      res.json({
        status: 'denied',
        authorization: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Deny error: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * POST /api/dashboard/objectives/:id/pause
   * Pause objective
   */
  router.post('/objectives/:id/pause', (req, res) => {
    try {
      const userId = req.body.user_id || 'system';
      const result = operationCentre.pauseObjective(req.params.id, userId);
      res.json({
        status: 'paused',
        objective: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Pause error: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * POST /api/dashboard/objectives/:id/resume
   * Resume objective
   */
  router.post('/objectives/:id/resume', (req, res) => {
    try {
      const userId = req.body.user_id || 'system';
      const result = operationCentre.resumeObjective(req.params.id, userId);
      res.json({
        status: 'resumed',
        objective: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Resume error: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * POST /api/dashboard/objectives/:id/cancel
   * Cancel objective
   */
  router.post('/objectives/:id/cancel', (req, res) => {
    try {
      const userId = req.body.user_id || 'system';
      const reason = req.body.reason || '';
      const result = operationCentre.cancelObjective(req.params.id, userId, reason);
      res.json({
        status: 'cancelled',
        objective: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Cancel error: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * GET /api/dashboard/health
   * Get system health
   */
  router.get('/health', (req, res) => {
    try {
      const health = operationCentre.getSystemHealth();
      res.json({
        health,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Health endpoint error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/dashboard/connections
   * Get WebSocket connection info
   */
  router.get('/connections', (req, res) => {
    try {
      const info = operationCentre.getConnectionInfo();
      res.json(info);
    } catch (error) {
      logger.error(`Connections endpoint error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
