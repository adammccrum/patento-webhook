/**
 * Execution engine - manages dependency-aware task execution
 */

const { TASK_STATES } = require('./task-schema');
const { AuditEvent, AUDIT_EVENT_TYPES } = require('../audit/audit-event-schema');
const logger = require('../utils/logger');

class ExecutionEngine {
  constructor(agentRegistry, providerRegistry, auditCallback = null) {
    this.agentRegistry = agentRegistry;
    this.providerRegistry = providerRegistry;
    this.executingTasks = new Map(); // taskId -> task
    this.auditLog = [];
    this.auditCallback = auditCallback; // Callback to report audit events
  }

  /**
   * Execute a task with dependency management
   */
  async executeTask(task, context = {}) {
    logger.info(`Starting execution of task ${task.id}`);

    task.setExecuting();
    this.executingTasks.set(task.id, task);

    try {
      // Execute subtasks in dependency order
      while (true) {
        const readySubtasks = task.getReadySubtasks();

        if (readySubtasks.length === 0) {
          // No more ready subtasks
          if (task.isComplete()) {
            // All subtasks completed successfully
            break;
          } else if (task.hasFailed()) {
            // Some subtasks failed permanently
            throw new Error('Task has unrecoverable failures');
          } else {
            // This shouldn't happen
            throw new Error('Deadlock: no ready subtasks but task not complete');
          }
        }

        // Execute ready subtasks
        await Promise.all(
          readySubtasks.map(st => this.executeSubtask(st, task, context))
        );
      }

      // All subtasks completed
      task.setCompleted();

      // Log completion
      this.recordAuditEvent({
        event_type: AUDIT_EVENT_TYPES.TASK_COMPLETED,
        action: 'execute_task',
        status: 'completed',
        details: {
          task_id: task.id,
          subtask_count: task.subtasks.length
        }
      });

      logger.info(`Task ${task.id} completed successfully`);
      return {
        success: true,
        task: task,
        results: task.results
      };
    } catch (error) {
      task.setFailed(error.message);

      // Log failure
      this.recordAuditEvent({
        event_type: AUDIT_EVENT_TYPES.TASK_FAILED,
        action: 'execute_task',
        status: 'failed',
        error: error.message,
        details: {
          task_id: task.id
        }
      });

      logger.error(`Task ${task.id} failed: ${error.message}`);
      throw error;
    } finally {
      this.executingTasks.delete(task.id);
    }
  }

  /**
   * Execute a single subtask with retry logic
   */
  async executeSubtask(subtask, task, context = {}) {
    logger.info(`Executing subtask ${subtask.id}: ${subtask.title}`);

    while (true) {
      try {
        subtask.setExecuting();

        // Get the agent
        const agent = this.agentRegistry.getAgent(subtask.agent_code);
        if (!agent) {
          throw new Error(`Agent ${subtask.agent_code} not found`);
        }

        // Check agent is enabled
        if (!agent.enabled) {
          throw new Error(`Agent ${subtask.agent_code} is not enabled`);
        }

        // Update agent status
        this.agentRegistry.updateStatus(
          subtask.agent_code,
          'working',
          { currentTask: subtask.id }
        );

        // Prepare execution context
        const executionContext = {
          ...context,
          subtask_id: subtask.id,
          task_id: task.id,
          capability: subtask.capability_required
        };

        // Execute subtask on agent
        const result = await this.executeOnAgent(
          agent,
          subtask,
          executionContext
        );

        // Record result
        subtask.setCompleted(result);
        task.results[subtask.id] = result;

        // Record agent completion
        this.agentRegistry.recordTaskCompletion(subtask.agent_code);

        // Audit log
        this.recordAuditEvent({
          event_type: AUDIT_EVENT_TYPES.AGENT_EXECUTED,
          action: subtask.capability_required,
          agent: agent.name,
          agent_code: agent.code,
          status: 'completed',
          details: {
            subtask_id: subtask.id,
            task_id: task.id,
            execution_time_ms: subtask.execution_time_ms
          }
        });

        logger.info(`Subtask ${subtask.id} completed successfully`);
        return result;
      } catch (error) {
        logger.warn(`Subtask ${subtask.id} failed (attempt ${subtask.retry_count + 1}): ${error.message}`);

        // Audit log failure
        this.recordAuditEvent({
          event_type: AUDIT_EVENT_TYPES.AGENT_FAILED,
          action: subtask.capability_required,
          agent_code: subtask.agent_code,
          status: 'failed',
          error: error.message,
          details: {
            subtask_id: subtask.id,
            task_id: task.id
          }
        });

        // Check if can retry
        if (subtask.canRetry()) {
          logger.info(`Retrying subtask ${subtask.id} (${subtask.retry_count + 1}/${subtask.max_retries})`);
          subtask.setRetrying();

          // Wait before retry (exponential backoff)
          const delayMs = Math.pow(2, subtask.retry_count) * 1000;
          await new Promise(resolve => setTimeout(resolve, delayMs));

          // Continue loop to retry
          continue;
        } else {
          // Max retries exceeded
          subtask.setFailed(error.message);

          // Record task failure
          this.agentRegistry.recordTaskFailure(subtask.agent_code, error.message);

          throw error;
        }
      }
    }
  }

  /**
   * Execute subtask on the selected agent
   * This is where agent-specific logic would be called
   */
  async executeOnAgent(agent, subtask, _context) {
    // For now, simulate agent execution
    // In Phase 3, this will call actual agent implementations

    logger.debug(`Delegating to agent ${agent.code}: ${subtask.capability_required}`);

    // Simulate async execution (in real implementation, this calls agent.execute())
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate successful completion
        resolve({
          agent_code: agent.code,
          subtask_id: subtask.id,
          capability: subtask.capability_required,
          output: subtask.input, // Echo input for now
          timestamp: new Date().toISOString()
        });
      }, 100); // Quick simulation delay
    });
  }

  /**
   * Record audit event
   */
  recordAuditEvent(eventData) {
    try {
      const event = new AuditEvent({
        ...eventData,
        agent: eventData.agent || 'ExecutionEngine'
      });
      this.auditLog.push(event);

      // Report to callback if provided
      if (this.auditCallback) {
        this.auditCallback(event);
      }

      logger.debug(`Audit event recorded: ${event.event_type}`);

      return event;
    } catch (error) {
      logger.error(`Failed to record audit event: ${error.message}`);
    }
  }

  /**
   * Get execution status
   */
  getStatus() {
    const executing = Array.from(this.executingTasks.values());

    return {
      executing_tasks: executing.length,
      tasks: executing.map(t => ({
        id: t.id,
        state: t.state,
        subtasks_completed: t.getSubtasksByState(TASK_STATES.COMPLETED).length,
        subtasks_total: t.subtasks.length
      })),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get audit log for a task
   */
  getTaskAuditLog(taskId) {
    return this.auditLog.filter(event => event.details?.task_id === taskId);
  }

  /**
   * Clear audit log (or archive it)
   */
  clearAuditLog() {
    const cleared = this.auditLog.length;
    this.auditLog = [];
    return cleared;
  }
}

module.exports = ExecutionEngine;
