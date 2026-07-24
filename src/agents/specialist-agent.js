/**
 * Specialist agent base class - template for all NATO agent implementations
 */

const { AGENT_STATES } = require('../utils/constants');
const logger = require('../utils/logger');

class SpecialistAgent {
  constructor(code, name, config = {}) {
    this.code = code; // e.g., 'EE'
    this.name = name; // e.g., 'Echo'
    this.config = config;
    this.state = AGENT_STATES.IDLE;
    this.currentTask = null;
    this.completedTasks = 0;
    this.failedTasks = 0;
    this.lastError = null;
    this.capabilities = config.capabilities || [];
    this.restricted_actions = config.restricted_actions || [];
    this.last_health_check = null;
  }

  /**
   * Execute a delegated task
   * Must be implemented by subclass
   */
  async execute(task, _context = {}) {
    throw new Error('execute() must be implemented by subclass');
  }

  /**
   * Check if agent can handle a specific capability
   */
  canHandle(capability) {
    return this.capabilities.includes(capability);
  }

  /**
   * Check if agent is allowed to perform an action
   */
  canPerform(action) {
    return !this.restricted_actions.includes(action);
  }

  /**
   * Validate task before execution
   */
  validateTask(task, _context) {
    if (!task.capability_required) {
      throw new Error('Task missing required capability');
    }

    if (!this.canHandle(task.capability_required)) {
      throw new Error(
        `Agent ${this.name} cannot handle capability: ${task.capability_required}`
      );
    }

    return true;
  }

  /**
   * Health check - can be overridden by subclass
   */
  async healthCheck() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      agent: this.name
    };
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      code: this.code,
      name: this.name,
      state: this.state,
      currentTask: this.currentTask,
      completedTasks: this.completedTasks,
      failedTasks: this.failedTasks,
      lastError: this.lastError,
      capabilities: this.capabilities,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Simulate task execution (stub for Phase 2)
   * Real implementation in Phase 3 when agents have providers
   */
  async simulateExecution(task, context = {}) {
    logger.info(`${this.name} (${this.code}) simulating execution of: ${task.title}`);

    // Validate task
    this.validateTask(task, context);

    // Update state
    this.state = AGENT_STATES.WORKING;
    this.currentTask = task.id;

    try {
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));

      // For now, return mock result
      const result = {
        agent: this.name,
        agent_code: this.code,
        task_id: task.id,
        capability: task.capability_required,
        status: 'completed',
        output: {
          message: `${this.name} completed task: ${task.title}`,
          input: task.input,
          timestamp: new Date().toISOString()
        }
      };

      this.completedTasks += 1;
      this.state = AGENT_STATES.IDLE;
      this.currentTask = null;

      return result;
    } catch (error) {
      this.failedTasks += 1;
      this.lastError = error.message;
      this.state = AGENT_STATES.FAILED;

      throw error;
    }
  }

  toJSON() {
    return this.getStatus();
  }
}

module.exports = SpecialistAgent;
