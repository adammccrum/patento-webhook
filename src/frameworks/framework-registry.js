/**
 * Framework Registry
 *
 * Registry for framework adapters with configuration and status tracking.
 */

const { FrameworkNotFoundError } = require('./framework-errors');

class FrameworkRegistry {
  constructor(options = {}) {
    this.frameworks = new Map();
    this.onEvent = options.onEvent || null;
  }

  /**
   * Register a framework
   * @param {FrameworkBase} adapter - Framework adapter instance
   * @param {Object} metadata - Framework metadata
   */
  register(adapter, metadata = {}) {
    if (!adapter.framework_id) {
      throw new Error('Framework adapter must have a framework_id');
    }

    if (this.frameworks.has(adapter.framework_id)) {
      throw new Error(`Framework ${adapter.framework_id} is already registered`);
    }

    const record = {
      framework_id: adapter.framework_id,
      display_name: metadata.display_name || adapter.display_name,
      category: metadata.category || 'general',
      official_repository: metadata.official_repository,
      official_website: metadata.official_website,
      maintainer: metadata.maintainer,
      licence: metadata.licence,
      language: metadata.language,
      runtime: metadata.runtime,
      latest_verified_version: metadata.latest_verified_version || adapter.version,
      verification_date: metadata.verification_date,
      maintenance_status: metadata.maintenance_status || 'unknown',
      community_size: metadata.community_size,
      adapter: adapter,
      adapter_status: metadata.adapter_status || 'stub',
      implementation_status: metadata.implementation_status || 'proposed',
      guardian_requirements: metadata.guardian_requirements || [],
      sierra_required: metadata.sierra_required !== false,
      uniform_required: metadata.uniform_required !== false,
      network_required: metadata.network_required || false,
      filesystem_required: metadata.filesystem_required || false,
      memory_model: metadata.memory_model,
      tool_execution_model: metadata.tool_execution_model,
      sandbox_support: metadata.sandbox_support || false,
      streaming_support: metadata.streaming_support || false,
      human_approval_support: metadata.human_approval_support || false,
      multi_agent_support: metadata.multi_agent_support || false,
      mcp_support: metadata.mcp_support || false,
      cost_model: metadata.cost_model,
      installation_method: metadata.installation_method,
      activation_state: metadata.activation_state || 'disabled',
      enabled: metadata.enabled !== false,
      health_status: 'unknown',
      last_health_check: null,
      notes: metadata.notes,
      registered_at: Date.now()
    };

    this.frameworks.set(adapter.framework_id, record);
    this._emitEvent('framework_registered', { framework_id: adapter.framework_id });
  }

  /**
   * Get framework record
   * @param {string} framework_id - Framework ID
   * @returns {Object|null} Framework record
   */
  get(framework_id) {
    return this.frameworks.get(framework_id);
  }

  /**
   * Get framework adapter
   * @param {string} framework_id - Framework ID
   * @returns {FrameworkBase|null} Framework adapter
   */
  getAdapter(framework_id) {
    const record = this.frameworks.get(framework_id);
    return record ? record.adapter : null;
  }

  /**
   * Get all registered frameworks
   * @returns {Array} Framework records
   */
  getAll() {
    return Array.from(this.frameworks.values());
  }

  /**
   * Get frameworks by category
   * @param {string} category - Framework category
   * @returns {Array} Framework records
   */
  getByCategory(category) {
    return Array.from(this.frameworks.values()).filter((r) => r.category === category);
  }

  /**
   * Get enabled frameworks
   * @returns {Array} Framework records
   */
  getEnabled() {
    return Array.from(this.frameworks.values()).filter((r) => r.enabled);
  }

  /**
   * Get frameworks by implementation status
   * @param {string} status - Implementation status
   * @returns {Array} Framework records
   */
  getByImplementationStatus(status) {
    return Array.from(this.frameworks.values()).filter((r) => r.implementation_status === status);
  }

  /**
   * Update framework health status
   * @param {string} framework_id - Framework ID
   * @param {Object} health - Health status
   */
  updateHealth(framework_id, health) {
    const record = this.frameworks.get(framework_id);
    if (record) {
      record.health_status = health.status || 'unknown';
      record.last_health_check = Date.now();
      this._emitEvent('framework_health_changed', {
        framework_id,
        health_status: record.health_status
      });
    }
  }

  /**
   * Enable framework
   * @param {string} framework_id - Framework ID
   */
  enable(framework_id) {
    const record = this.frameworks.get(framework_id);
    if (record) {
      record.enabled = true;
      this._emitEvent('framework_enabled', { framework_id });
    }
  }

  /**
   * Disable framework
   * @param {string} framework_id - Framework ID
   */
  disable(framework_id) {
    const record = this.frameworks.get(framework_id);
    if (record) {
      record.enabled = false;
      this._emitEvent('framework_disabled', { framework_id });
    }
  }

  /**
   * Unregister framework
   * @param {string} framework_id - Framework ID
   */
  unregister(framework_id) {
    this.frameworks.delete(framework_id);
    this._emitEvent('framework_unregistered', { framework_id });
  }

  /**
   * Get registry statistics
   * @returns {Object} statistics
   */
  getStats() {
    const all = Array.from(this.frameworks.values());
    return {
      total: all.length,
      enabled: all.filter((r) => r.enabled).length,
      disabled: all.filter((r) => !r.enabled).length,
      by_category: this._groupByCategory(all),
      by_implementation_status: this._groupByStatus(all),
      by_health: this._groupByHealth(all)
    };
  }

  /**
   * Private: Emit event
   * @private
   */
  _emitEvent(type, data = {}) {
    if (this.onEvent) {
      this.onEvent({
        type: `framework.${type}`,
        ...data,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Private: Group by category
   * @private
   */
  _groupByCategory(records) {
    const groups = {};
    records.forEach((r) => {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r.framework_id);
    });
    return groups;
  }

  /**
   * Private: Group by status
   * @private
   */
  _groupByStatus(records) {
    const groups = {};
    records.forEach((r) => {
      if (!groups[r.implementation_status]) groups[r.implementation_status] = [];
      groups[r.implementation_status].push(r.framework_id);
    });
    return groups;
  }

  /**
   * Private: Group by health
   * @private
   */
  _groupByHealth(records) {
    return {
      healthy: records.filter((r) => r.health_status === 'healthy').map((r) => r.framework_id),
      degraded: records.filter((r) => r.health_status === 'degraded').map((r) => r.framework_id),
      unhealthy: records.filter((r) => r.health_status === 'unhealthy').map((r) => r.framework_id),
      unknown: records.filter((r) => r.health_status === 'unknown').map((r) => r.framework_id)
    };
  }
}

module.exports = FrameworkRegistry;
