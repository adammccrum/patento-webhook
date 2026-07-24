/**
 * Alpha Orchestrator v2 - Full orchestration implementation
 * Coordinates task decomposition, agent delegation, and result aggregation
 */

const { v4: uuid } = require('uuid');
const { AGENT_STATES } = require('../utils/constants');
const { Objective, OBJECTIVE_TYPES } = require('../orchestration/task-schema');
const { AuditEvent, AUDIT_EVENT_TYPES } = require('../audit/audit-event-schema');
const ObjectiveClassifier = require('../orchestration/objective-classifier');
const TaskPlanner = require('../orchestration/task-planner');
const ExecutionEngine = require('../orchestration/execution-engine');
const logger = require('../utils/logger');

class AlphaOrchestratorV2 {
  constructor(agentRegistry, providerRegistry, config = {}) {
    this.name = 'Alpha';
    this.code = 'AA';
    this.agentRegistry = agentRegistry;
    this.providerRegistry = providerRegistry;
    this.config = config;

    // Initialize subsystems
    this.classifier = new ObjectiveClassifier(agentRegistry);
    this.planner = new TaskPlanner(agentRegistry, this.classifier);
    // Pass audit callback to executor
    this.executor = new ExecutionEngine(
      agentRegistry,
      providerRegistry,
      (event) => this.auditLog.push(event) // Collect executor events in Alpha's log
    );

    // State tracking
    this.objectives = new Map(); // objectiveId -> objective
    this.tasks = new Map(); // taskId -> task
    this.auditLog = [];
    this.state = AGENT_STATES.IDLE;
  }

  /**
   * Main entry point: Receive user objective
   */
  async receiveObjective(objectiveData) {
    logger.info(`Alpha received objective: ${objectiveData.description}`);

    try {
      // Create objective object
      const objective = new Objective({
        ...objectiveData,
        id: objectiveData.id || uuid()
      });

      // Store objective
      this.objectives.set(objective.id, objective);

      // Audit: Objective received
      this.recordAudit({
        event_type: AUDIT_EVENT_TYPES.OBJECTIVE_RECEIVED,
        action: 'receive_objective',
        user_id: objective.user_id,
        status: 'pending',
        details: {
          objective_id: objective.id,
          description: objective.description
        }
      });

      // Plan task execution
      const task = this.planner.plan(objective);
      this.tasks.set(task.id, task);
      objective.tasks.push(task.id);

      // Audit: Task planned
      this.recordAudit({
        event_type: AUDIT_EVENT_TYPES.TASK_PLANNED,
        action: 'plan_task',
        status: 'completed',
        details: {
          task_id: task.id,
          objective_id: objective.id,
          subtask_count: task.subtasks.length
        }
      });

      logger.info(`Planned task ${task.id} with ${task.subtasks.length} subtasks`);

      // Return response
      return {
        objective_id: objective.id,
        task_id: task.id,
        status: 'planned',
        subtask_count: task.subtasks.length,
        estimated_steps: task.subtasks.length
      };
    } catch (error) {
      logger.error(`Failed to process objective: ${error.message}`);

      this.recordAudit({
        event_type: AUDIT_EVENT_TYPES.OBJECTIVE_FAILED,
        action: 'receive_objective',
        error: error.message,
        status: 'failed',
        details: {
          description: objectiveData.description
        }
      });

      throw error;
    }
  }

  /**
   * Execute a planned task
   */
  async executeTask(taskId, context = {}) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    logger.info(`Alpha executing task ${taskId}`);

    try {
      // Execute with engine
      const result = await this.executor.executeTask(task, context);

      // Aggregate results
      const aggregated = this.aggregateResults(task);

      // Audit: Task execution complete
      this.recordAudit({
        event_type: AUDIT_EVENT_TYPES.TASK_COMPLETED,
        action: 'execute_task',
        status: 'completed',
        details: {
          task_id: task.id,
          subtask_count: task.subtasks.length
        }
      });

      return {
        success: true,
        task_id: taskId,
        results: aggregated,
        audit_trail: this.getTaskAuditLog(taskId)
      };
    } catch (error) {
      logger.error(`Task ${taskId} execution failed: ${error.message}`);

      this.recordAudit({
        event_type: AUDIT_EVENT_TYPES.TASK_FAILED,
        action: 'execute_task',
        error: error.message,
        status: 'failed',
        details: {
          task_id: taskId
        }
      });

      throw error;
    }
  }

  /**
   * Classify user objective without executing
   */
  classifyObjective(description) {
    const tmpObjective = new Objective({
      description,
      user_id: 'system'
    });

    const classification = this.classifier.classify(tmpObjective);
    const suggestedAgents = this.classifier.suggestAgents(classification.type);
    const entities = this.classifier.extractEntities(tmpObjective);

    return {
      type: classification.type,
      confidence: classification.confidence,
      suggested_agents: suggestedAgents.map(code => {
        const agent = this.agentRegistry.getAgent(code);
        return {
          code: agent.code,
          name: agent.name,
          role: agent.role
        };
      }),
      entities
    };
  }

  /**
   * Get task plan without executing
   */
  planOnly(objectiveData) {
    const objective = new Objective(objectiveData);
    const task = this.planner.plan(objective);

    return {
      task_id: task.id,
      subtasks: task.subtasks.map(st => ({
        id: st.id,
        title: st.title,
        description: st.description,
        agent_code: st.agent_code,
        agent_name: this.agentRegistry.getAgent(st.agent_code).name,
        capability: st.capability_required,
        dependencies: st.dependencies,
        estimated_retries: st.max_retries
      })),
      total_subtasks: task.subtasks.length
    };
  }

  /**
   * Aggregate results from all subtasks
   */
  aggregateResults(task) {
    const results = {
      task_id: task.id,
      status: task.state,
      subtasks_completed: task.getSubtasksByState('completed').length,
      subtasks_failed: task.getSubtasksByState('failed').length,
      total_subtasks: task.subtasks.length,
      execution_time_ms: new Date(task.completed_at) - new Date(task.started_at),
      final_results: {}
    };

    // Aggregate outputs from all subtasks
    for (const subtask of task.subtasks) {
      if (subtask.output) {
        results.final_results[subtask.agent_code] = {
          title: subtask.title,
          output: subtask.output,
          execution_time_ms: subtask.execution_time_ms
        };
      }
    }

    return results;
  }

  /**
   * Handle escalation for restricted actions
   */
  async escalateAction(actionId, actionType, context = {}) {
    logger.warn(`Escalating action ${actionId} of type ${actionType}`);

    // Find appropriate escalation target (usually a human review or security agent)
    // For now, log and return pending status
    this.recordAudit({
      event_type: AUDIT_EVENT_TYPES.ACTION_ESCALATED,
      action: actionType,
      status: 'pending',
      details: {
        action_id: actionId,
        action_type: actionType
      }
    });

    return {
      status: 'escalated',
      action_id: actionId,
      action_type: actionType,
      escalation_required: true
    };
  }

  /**
   * Record audit event
   */
  recordAudit(eventData) {
    try {
      const event = new AuditEvent({
        ...eventData,
        agent: this.name,
        agent_code: this.code
      });

      this.auditLog.push(event);
      logger.debug(`Audit: ${event.event_type}`);

      return event;
    } catch (error) {
      logger.error(`Failed to record audit: ${error.message}`);
    }
  }

  /**
   * Get audit log for a task
   */
  getTaskAuditLog(taskId) {
    return this.auditLog.filter(event => {
      // Check multiple possible locations for task_id reference
      if (event.details) {
        return event.details.task_id === taskId ||
               event.details.objective_id === taskId ||
               event.details.subtask_id === taskId;
      }
      // Fallback to checking top-level properties
      return event.task_id === taskId || event.objective_id === taskId;
    });
  }

  /**
   * Get orchestrator status
   */
  getStatus() {
    return {
      agent: this.name,
      code: this.code,
      state: this.state,
      objectives_received: this.objectives.size,
      tasks_created: this.tasks.size,
      executing_tasks: this.executor.getStatus().executing_tasks,
      audit_events: this.auditLog.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get objective status
   */
  getObjectiveStatus(objectiveId) {
    const objective = this.objectives.get(objectiveId);
    if (!objective) {
      throw new Error(`Objective ${objectiveId} not found`);
    }

    const taskIds = objective.tasks;
    const tasks = taskIds.map(id => this.tasks.get(id));

    return {
      objective_id: objective.id,
      description: objective.description,
      type: objective.type,
      state: objective.state,
      tasks: tasks.map(t => ({
        id: t.id,
        state: t.state,
        subtasks_completed: t.getSubtasksByState('completed').length,
        subtasks_failed: t.getSubtasksByState('failed').length,
        total_subtasks: t.subtasks.length
      })),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Export execution trace for audit
   */
  exportAuditTrail(format = 'json') {
    if (format === 'json') {
      return this.auditLog.map(e => e.toJSON());
    }

    // CSV format for external systems
    if (format === 'csv') {
      const headers = ['timestamp', 'event_type', 'agent', 'action', 'status', 'details'];
      const rows = this.auditLog.map(e => [
        e.timestamp,
        e.event_type,
        e.agent,
        e.details?.action || '',
        e.status,
        JSON.stringify(e.details)
      ]);

      return [headers, ...rows].map(r => r.join(',')).join('\n');
    }

    throw new Error(`Unsupported format: ${format}`);
  }
}

module.exports = AlphaOrchestratorV2;
