/**
 * Agent registry - loads and manages all agents from configuration
 */

const logger = require('../utils/logger');
const { AgentDefinition, AgentStatus } = require('./agent-models');
const { AgentNotFoundError } = require('../utils/errors');

class AgentRegistry {
  constructor() {
    this.agents = new Map();     // code -> AgentDefinition
    this.statuses = new Map();   // code -> AgentStatus
  }

  /**
   * Register an agent from definition
   */
  registerAgent(definition) {
    const validation = AgentDefinition.validate(definition);
    if (!validation.valid) {
      throw new Error(`Invalid agent definition: ${validation.errors.join(', ')}`);
    }

    const agent = new AgentDefinition(definition);
    this.agents.set(agent.code, agent);
    this.statuses.set(agent.code, new AgentStatus(agent.code, agent.current_status));

    logger.debug(`Registered agent: ${agent.name} (${agent.code})`);
  }

  /**
   * Register multiple agents
   */
  registerAgents(definitions) {
    if (!Array.isArray(definitions)) {
      throw new Error('Definitions must be an array');
    }
    definitions.forEach(def => this.registerAgent(def));
  }

  /**
   * Get agent by code
   */
  getAgent(code) {
    const agent = this.agents.get(code);
    if (!agent) {
      throw new AgentNotFoundError(code);
    }
    return agent;
  }

  /**
   * Get agent status
   */
  getStatus(code) {
    const status = this.statuses.get(code);
    if (!status) {
      throw new AgentNotFoundError(code);
    }
    return status;
  }

  /**
   * Get agents by capability
   */
  getAgentsByCapability(capability) {
    const matching = [];
    for (const [_code, agent] of this.agents.entries()) {
      if (agent.enabled && agent.capabilities.includes(capability)) {
        matching.push(agent);
      }
    }
    return matching;
  }

  /**
   * Get all enabled agents
   */
  getEnabledAgents() {
    return Array.from(this.agents.values()).filter(a => a.enabled);
  }

  /**
   * Update agent status
   */
  updateStatus(code, state, details = {}) {
    const status = this.getStatus(code);
    status.updateState(state);
    if (details.currentTask) status.currentTask = details.currentTask;
    if (details.lastError) status.lastError = details.lastError;
    this.statuses.set(code, status);
  }

  /**
   * Record task completion
   */
  recordTaskCompletion(code) {
    const status = this.getStatus(code);
    status.completedTasks += 1;
    this.statuses.set(code, status);
  }

  /**
   * Record task failure
   */
  recordTaskFailure(code, error) {
    const status = this.getStatus(code);
    status.failedTasks += 1;
    status.lastError = error;
    this.statuses.set(code, status);
  }

  /**
   * Get all agent statuses
   */
  getAllStatuses() {
    const statuses = {};
    for (const [code, status] of this.statuses.entries()) {
      statuses[code] = status.toJSON();
    }
    return statuses;
  }

  /**
   * Get comprehensive status report
   */
  getStatusReport() {
    return {
      timestamp: new Date().toISOString(),
      total_agents: this.agents.size,
      enabled_agents: this.getEnabledAgents().length,
      agents: this.getAllStatuses()
    };
  }

  /**
   * Validate all agents
   */
  validate() {
    const errors = [];
    for (const [code, agent] of this.agents.entries()) {
      const validation = AgentDefinition.validate(agent);
      if (!validation.valid) {
        errors.push({ code, errors: validation.errors });
      }
    }
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = AgentRegistry;
