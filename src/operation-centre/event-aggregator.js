/**
 * Event Aggregator - Collects events from orchestration layer and distributes to subscribers
 * Maintains real-time state for dashboard
 */

const { EventEmitter } = require('events');
const { v4: uuid } = require('uuid');
const logger = require('../utils/logger');

class EventAggregator extends EventEmitter {
  constructor() {
    super();
    this.subscribers = new Map(); // subscriberId -> filters
    this.eventHistory = []; // Recent events for replay
    this.maxHistorySize = 1000;
    this.objectiveState = new Map(); // objectiveId -> current state
    this.taskState = new Map(); // taskId -> current state
    this.agentState = new Map(); // agentCode -> current state
  }

  /**
   * Record an event from the orchestration layer
   */
  recordEvent(event) {
    const fullEvent = {
      id: event.id || uuid(),
      timestamp: event.timestamp || new Date().toISOString(),
      type: event.type,
      agent: event.agent,
      agent_code: event.agent_code,
      objective_id: event.objective_id,
      task_id: event.task_id,
      subtask_id: event.subtask_id,
      action: event.action,
      status: event.status,
      details: event.details || {},
      error: event.error || null
    };

    // Add to history
    this.eventHistory.push(fullEvent);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Update state based on event type
    this.updateState(fullEvent);

    // Emit to subscribers
    this.distributeEvent(fullEvent);

    logger.debug(`Event aggregated: ${fullEvent.type} (${fullEvent.id})`);
    return fullEvent;
  }

  /**
   * Update internal state based on event
   */
  updateState(event) {
    if (event.objective_id) {
      const state = this.objectiveState.get(event.objective_id) || {};
      state.objective_id = event.objective_id;
      state.status = event.status;
      state.last_event = event.type;
      state.last_event_time = event.timestamp;
      this.objectiveState.set(event.objective_id, state);
    }

    if (event.task_id) {
      const state = this.taskState.get(event.task_id) || {};
      state.task_id = event.task_id;
      state.status = event.status;
      state.last_event = event.type;
      state.last_event_time = event.timestamp;
      if (event.action) state.current_action = event.action;
      this.taskState.set(event.task_id, state);
    }

    if (event.agent_code) {
      const state = this.agentState.get(event.agent_code) || {};
      state.agent_code = event.agent_code;
      state.agent = event.agent;
      state.status = event.status;
      state.last_event = event.type;
      state.last_event_time = event.timestamp;
      if (event.task_id) state.current_task = event.task_id;
      if (event.action) state.current_action = event.action;
      this.agentState.set(event.agent_code, state);
    }
  }

  /**
   * Distribute event to all matching subscribers
   */
  distributeEvent(event) {
    for (const [subscriberId, filters] of this.subscribers.entries()) {
      if (this.matchesFilters(event, filters)) {
        this.emit(`subscriber:${subscriberId}`, event);
      }
    }
  }

  /**
   * Check if event matches subscriber filters
   */
  matchesFilters(event, filters) {
    if (!filters || Object.keys(filters).length === 0) {
      return true; // No filters, match all
    }

    if (filters.types && !filters.types.includes(event.type)) {
      return false;
    }

    if (filters.agent_codes && !filters.agent_codes.includes(event.agent_code)) {
      return false;
    }

    if (filters.status && filters.status !== event.status) {
      return false;
    }

    if (filters.objective_id && filters.objective_id !== event.objective_id) {
      return false;
    }

    if (filters.task_id && filters.task_id !== event.task_id) {
      return false;
    }

    return true;
  }

  /**
   * Subscribe to events with optional filters
   */
  subscribe(filters = {}) {
    const subscriberId = uuid();
    this.subscribers.set(subscriberId, filters);

    logger.debug(`Subscriber registered: ${subscriberId} with filters: ${JSON.stringify(filters)}`);

    return {
      subscriberId,
      unsubscribe: () => this.unsubscribe(subscriberId)
    };
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriberId) {
    this.subscribers.delete(subscriberId);
    this.removeAllListeners(`subscriber:${subscriberId}`);
    logger.debug(`Subscriber unregistered: ${subscriberId}`);
  }

  /**
   * Get recent events (for replay on reconnect)
   */
  getRecentEvents(limit = 50, filters = {}) {
    let events = [...this.eventHistory];

    // Apply filters
    if (filters.types) {
      events = events.filter(e => filters.types.includes(e.type));
    }
    if (filters.since) {
      const sinceTime = new Date(filters.since).getTime();
      events = events.filter(e => new Date(e.timestamp).getTime() >= sinceTime);
    }
    if (filters.agent_codes) {
      events = events.filter(e => filters.agent_codes.includes(e.agent_code));
    }

    // Return most recent
    return events.slice(-limit);
  }

  /**
   * Get current state snapshots
   */
  getStateSnapshot() {
    return {
      objectives: Array.from(this.objectiveState.values()),
      tasks: Array.from(this.taskState.values()),
      agents: Array.from(this.agentState.values()),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get objective state
   */
  getObjectiveState(objectiveId) {
    return this.objectiveState.get(objectiveId);
  }

  /**
   * Get task state
   */
  getTaskState(taskId) {
    return this.taskState.get(taskId);
  }

  /**
   * Get agent state
   */
  getAgentState(agentCode) {
    return this.agentState.get(agentCode);
  }

  /**
   * Clear old events (for memory management)
   */
  clearOldEvents(beforeTime) {
    const beforeMs = new Date(beforeTime).getTime();
    this.eventHistory = this.eventHistory.filter(
      e => new Date(e.timestamp).getTime() >= beforeMs
    );
  }
}

module.exports = EventAggregator;
