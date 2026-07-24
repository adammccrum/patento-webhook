/**
 * Alpha Orchestrator - Executive agent
 * Routes tasks to specialist agents and coordinates all operations
 */

const { v4: uuid } = require('uuid');
const logger = require('../utils/logger');
const { AGENT_STATES } = require('../utils/constants');

class AlphaOrchestrator {
  constructor(agentRegistry, config = {}) {
    this.name = 'Alpha';
    this.code = 'AA';
    this.agentRegistry = agentRegistry;
    this.config = config;
    this.taskQueue = [];
    this.executingTasks = new Map();
  }

  /**
   * Receive objective from user
   */
  async receiveObjective(objective) {
    const taskId = uuid();

    logger.info(`Alpha received objective: ${objective.description}`);

    const task = {
      id: taskId,
      objective: objective,
      created_at: new Date().toISOString(),
      status: AGENT_STATES.QUEUED
    };

    this.taskQueue.push(task);
    logger.debug(`Alpha queued task ${taskId}`);

    return {
      task_id: taskId,
      status: AGENT_STATES.QUEUED,
      message: 'Objective received and queued'
    };
  }

  /**
   * Get current status
   */
  async getStatus() {
    return {
      agent: this.name,
      code: this.code,
      status: AGENT_STATES.IDLE,
      agents_registered: this.agentRegistry.agents.size,
      tasks_queued: this.taskQueue.length,
      tasks_executing: this.executingTasks.size,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get all agent statuses
   */
  async getAgentStatuses() {
    return this.agentRegistry.getStatusReport();
  }
}

module.exports = AlphaOrchestrator;
