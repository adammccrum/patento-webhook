/**
 * Task and subtask schemas for orchestration
 */

const { v4: uuid } = require('uuid');
const Joi = require('joi');

const TASK_STATES = {
  PENDING: 'pending',
  BLOCKED: 'blocked',
  READY: 'ready',
  EXECUTING: 'executing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RETRYING: 'retrying'
};

const OBJECTIVE_TYPES = {
  CREATE_CONTENT: 'create_content',
  ANALYZE_DATA: 'analyze_data',
  GENERATE_MEDIA: 'generate_media',
  AUTOMATE_WORKFLOW: 'automate_workflow',
  PROVIDE_CONSULTATION: 'provide_consultation',
  INTEGRATE_SYSTEM: 'integrate_system',
  OTHER: 'other'
};

/**
 * Subtask - atomic unit of work
 */
class Subtask {
  constructor(data) {
    this.id = data.id || uuid();
    this.title = data.title;
    this.description = data.description;
    this.agent_code = data.agent_code;
    this.capability_required = data.capability_required;
    this.input = data.input || {};
    this.output = null;
    this.error = null;
    this.state = TASK_STATES.PENDING;
    this.dependencies = data.dependencies || []; // Array of subtask IDs
    this.retry_count = 0;
    this.max_retries = data.max_retries || 3;
    this.created_at = new Date().toISOString();
    this.started_at = null;
    this.completed_at = null;
    this.execution_time_ms = 0;
  }

  static validate(data) {
    const schema = Joi.object({
      title: Joi.string().required(),
      description: Joi.string().required(),
      agent_code: Joi.string().length(2).required(),
      capability_required: Joi.string().required(),
      input: Joi.object().default({}),
      dependencies: Joi.array().items(Joi.string().uuid()).default([]),
      max_retries: Joi.number().min(0).max(10).default(3)
    });

    const { error, value } = schema.validate(data);
    return {
      valid: !error,
      errors: error ? [error.message] : [],
      data: value
    };
  }

  setExecuting() {
    this.state = TASK_STATES.EXECUTING;
    this.started_at = new Date().toISOString();
  }

  setCompleted(output) {
    this.state = TASK_STATES.COMPLETED;
    this.output = output;
    this.completed_at = new Date().toISOString();
    this.execution_time_ms = new Date(this.completed_at) - new Date(this.started_at);
  }

  setFailed(error) {
    this.state = TASK_STATES.FAILED;
    this.error = error;
    this.completed_at = new Date().toISOString();
    this.execution_time_ms = new Date(this.completed_at) - new Date(this.started_at);
  }

  canRetry() {
    return this.retry_count < this.max_retries;
  }

  setRetrying() {
    if (this.canRetry()) {
      this.state = TASK_STATES.RETRYING;
      this.retry_count += 1;
      this.started_at = null;
      this.error = null;
      return true;
    }
    return false;
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      agent_code: this.agent_code,
      capability_required: this.capability_required,
      input: this.input,
      output: this.output,
      error: this.error,
      state: this.state,
      dependencies: this.dependencies,
      retry_count: this.retry_count,
      max_retries: this.max_retries,
      created_at: this.created_at,
      started_at: this.started_at,
      completed_at: this.completed_at,
      execution_time_ms: this.execution_time_ms
    };
  }
}

/**
 * Task - collection of subtasks with dependencies
 */
class Task {
  constructor(data) {
    this.id = data.id || uuid();
    this.objective_id = data.objective_id;
    this.title = data.title;
    this.description = data.description;
    this.objective_type = data.objective_type || OBJECTIVE_TYPES.OTHER;
    this.user_id = data.user_id;
    this.state = TASK_STATES.PENDING;
    this.subtasks = []; // Array of Subtask objects
    this.subtask_map = new Map(); // subtask.id -> subtask
    this.results = {}; // subtask.id -> result
    this.created_at = new Date().toISOString();
    this.started_at = null;
    this.completed_at = null;
    this.error = null;
    this.priority = data.priority || 'normal'; // low, normal, high
  }

  addSubtask(subtaskData) {
    const validation = Subtask.validate(subtaskData);
    if (!validation.valid) {
      throw new Error(`Invalid subtask: ${validation.errors.join(', ')}`);
    }

    const subtask = new Subtask(validation.data);
    this.subtasks.push(subtask);
    this.subtask_map.set(subtask.id, subtask);
    return subtask;
  }

  getSubtask(subtaskId) {
    return this.subtask_map.get(subtaskId);
  }

  /**
   * Get subtasks ready for execution (all dependencies completed)
   */
  getReadySubtasks() {
    return this.subtasks.filter(st => {
      if (st.state !== TASK_STATES.PENDING && st.state !== TASK_STATES.RETRYING) {
        return false;
      }

      // Check if all dependencies are completed
      return st.dependencies.every(depId => {
        const dep = this.getSubtask(depId);
        return dep && dep.state === TASK_STATES.COMPLETED;
      });
    });
  }

  /**
   * Get all subtasks with a specific state
   */
  getSubtasksByState(state) {
    return this.subtasks.filter(st => st.state === state);
  }

  /**
   * Check if task is complete (all subtasks done)
   */
  isComplete() {
    return this.subtasks.length > 0 &&
           this.subtasks.every(st => st.state === TASK_STATES.COMPLETED);
  }

  /**
   * Check if task has failed (any subtask failed)
   */
  hasFailed() {
    return this.subtasks.some(st => st.state === TASK_STATES.FAILED);
  }

  setExecuting() {
    this.state = TASK_STATES.EXECUTING;
    this.started_at = new Date().toISOString();
  }

  setCompleted() {
    this.state = TASK_STATES.COMPLETED;
    this.completed_at = new Date().toISOString();
  }

  setFailed(error) {
    this.state = TASK_STATES.FAILED;
    this.error = error;
    this.completed_at = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      objective_id: this.objective_id,
      title: this.title,
      description: this.description,
      objective_type: this.objective_type,
      user_id: this.user_id,
      state: this.state,
      subtasks: this.subtasks.map(st => st.toJSON()),
      results: this.results,
      created_at: this.created_at,
      started_at: this.started_at,
      completed_at: this.completed_at,
      error: this.error,
      priority: this.priority
    };
  }
}

/**
 * Objective - user request to system
 */
class Objective {
  constructor(data) {
    this.id = data.id || uuid();
    this.user_id = data.user_id;
    this.description = data.description;
    this.type = data.type || OBJECTIVE_TYPES.OTHER;
    this.context = data.context || {};
    this.constraints = data.constraints || {};
    this.created_at = new Date().toISOString();
    this.tasks = []; // Array of Task IDs
    this.state = 'received';
  }

  toJSON() {
    return {
      id: this.id,
      user_id: this.user_id,
      description: this.description,
      type: this.type,
      context: this.context,
      constraints: this.constraints,
      created_at: this.created_at,
      tasks: this.tasks,
      state: this.state
    };
  }
}

module.exports = {
  Subtask,
  Task,
  Objective,
  TASK_STATES,
  OBJECTIVE_TYPES
};
