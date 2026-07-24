/**
 * Audit event schema and validation
 * Immutable events recorded for compliance and debugging
 */

const { v4: uuid } = require('uuid');
const { AUDIT_EVENT_TYPES } = require('../utils/constants');

/**
 * Audit event model - 12+ required fields
 */
class AuditEvent {
  constructor(data) {
    this.id = data.id || uuid();
    this.timestamp = data.timestamp || new Date().toISOString();
    this.event_type = data.event_type;
    this.agent = data.agent;
    this.agent_code = data.agent_code;
    this.action = data.action;
    this.user_id = data.user_id || 'system';
    this.resource_ids = data.resource_ids || [];
    this.status = data.status || 'completed';
    this.cost = data.cost || 0;
    this.provider_used = data.provider_used || null;
    this.details = data.details || {};
    this.error = data.error || null;
  }

  /**
   * Validate audit event
   */
  static validate(data) {
    const errors = [];
    if (!data.event_type) errors.push('Missing event_type');
    if (!data.agent) errors.push('Missing agent');
    if (!data.action) errors.push('Missing action');
    if (!data.status) errors.push('Missing status');
    if (data.status && !['completed', 'failed', 'pending'].includes(data.status)) {
      errors.push('Invalid status value');
    }
    return {
      valid: errors.length === 0,
      errors
    };
  }

  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      event_type: this.event_type,
      agent: this.agent,
      agent_code: this.agent_code,
      action: this.action,
      user_id: this.user_id,
      resource_ids: this.resource_ids,
      status: this.status,
      cost: this.cost,
      provider_used: this.provider_used,
      details: this.details,
      error: this.error
    };
  }
}

module.exports = {
  AuditEvent,
  AUDIT_EVENT_TYPES
};
