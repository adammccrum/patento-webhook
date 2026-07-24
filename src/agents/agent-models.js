/**
 * Agent data models and types
 */

const { AGENT_STATES, NATO_CODES } = require('../utils/constants');

/**
 * Agent status model
 * Tracks current state of an agent
 */
class AgentStatus {
  constructor(agentCode, state = AGENT_STATES.IDLE) {
    this.agentCode = agentCode;
    this.state = state;
    this.lastUpdated = new Date().toISOString();
    this.currentTask = null;
    this.completedTasks = 0;
    this.failedTasks = 0;
    this.lastError = null;
  }

  static isValid(state) {
    return Object.values(AGENT_STATES).includes(state);
  }

  updateState(newState) {
    if (!AgentStatus.isValid(newState)) {
      throw new Error(`Invalid state: ${newState}`);
    }
    this.state = newState;
    this.lastUpdated = new Date().toISOString();
  }

  toJSON() {
    return {
      agentCode: this.agentCode,
      state: this.state,
      lastUpdated: this.lastUpdated,
      currentTask: this.currentTask,
      completedTasks: this.completedTasks,
      failedTasks: this.failedTasks,
      lastError: this.lastError
    };
  }
}

/**
 * Agent definition schema - 14 required fields
 */
class AgentDefinition {
  constructor(data) {
    this.code = data.code;                              // e.g., 'AA'
    this.name = data.name;                              // e.g., 'Alpha'
    this.role = data.role;                              // e.g., 'Executive Orchestrator'
    this.description = data.description;                // Purpose and responsibilities
    this.capabilities = data.capabilities || [];        // What the agent can do
    this.permissions = data.permissions || [];          // What the agent is allowed to do
    this.restricted_actions = data.restricted_actions || []; // Actions this agent cannot perform
    this.preferred_models = data.preferred_models || []; // LLMs to use
    this.available_tools = data.available_tools || [];  // Tools available to agent
    this.voice_profile = data.voice_profile || null;    // Voice configuration if applicable
    this.escalation_target = data.escalation_target || 'AA'; // Who to escalate to
    this.enabled = data.enabled !== false;              // Is agent active?
    this.current_status = data.current_status || AGENT_STATES.IDLE;
    this.last_health_check = data.last_health_check || null;
  }

  /**
   * Validate agent definition against schema
   */
  static validate(data) {
    const errors = [];

    if (!data.code) errors.push('Missing required field: code');
    if (!data.name) errors.push('Missing required field: name');
    if (!data.role) errors.push('Missing required field: role');
    if (!data.description) errors.push('Missing required field: description');
    if (!NATO_CODES[data.code]) errors.push(`Invalid NATO code: ${data.code}`);

    return {
      valid: errors.length === 0,
      errors
    };
  }

  toJSON() {
    return {
      code: this.code,
      name: this.name,
      role: this.role,
      description: this.description,
      capabilities: this.capabilities,
      permissions: this.permissions,
      restricted_actions: this.restricted_actions,
      preferred_models: this.preferred_models,
      available_tools: this.available_tools,
      voice_profile: this.voice_profile,
      escalation_target: this.escalation_target,
      enabled: this.enabled,
      current_status: this.current_status,
      last_health_check: this.last_health_check
    };
  }
}

module.exports = {
  AgentStatus,
  AgentDefinition
};
