/**
 * Guardian Registry
 *
 * Registry for Guardian adapters with configuration and status tracking.
 */

const { GuardianRegistryError } = require('./guardian-errors');

class GuardianRegistry {
  constructor(options = {}) {
    this.guardians = new Map();
    this.onEvent = options.onEvent || null;
  }

  /**
   * Register a Guardian
   * @param {GuardianBase} guardian - Guardian instance
   * @param {Object} metadata - Registration metadata
   */
  register(guardian, metadata = {}) {
    if (!guardian.guardian_id) {
      throw new GuardianRegistryError('Guardian must have a guardian_id');
    }

    if (this.guardians.has(guardian.guardian_id)) {
      throw new GuardianRegistryError(`Guardian ${guardian.guardian_id} is already registered`);
    }

    const record = {
      guardian_id: guardian.guardian_id,
      display_name: metadata.display_name || guardian.display_name || guardian.guardian_id,
      category: guardian.category,
      adapter: guardian,
      repository: metadata.repository,
      licence: metadata.licence,
      version: guardian.version,
      enabled: guardian.enabled,
      installed: true,
      configured: metadata.configured !== false,
      required_for: metadata.required_for || [],
      execution_mode: metadata.execution_mode || ['synchronous', 'asynchronous'],
      network_required: metadata.network_required || false,
      supported_actions: metadata.supported_actions || [],
      supported_resource_types: metadata.supported_resource_types || [],
      priority: guardian.priority || 100,
      timeout_ms: guardian.timeout_ms,
      fail_mode: guardian.fail_mode,
      health_status: 'unknown',
      last_health_check: null,
      implementation_status: metadata.implementation_status || 'development',
      registered_at: Date.now()
    };

    this.guardians.set(guardian.guardian_id, record);
    this._emitEvent('guardian_registered', { guardian_id: guardian.guardian_id });
  }

  /**
   * Get Guardian record
   * @param {string} guardian_id - Guardian ID
   * @returns {Object|null} Guardian record
   */
  get(guardian_id) {
    return this.guardians.get(guardian_id);
  }

  /**
   * Get Guardian adapter
   * @param {string} guardian_id - Guardian ID
   * @returns {GuardianBase|null} Guardian adapter
   */
  getAdapter(guardian_id) {
    const record = this.guardians.get(guardian_id);
    return record ? record.adapter : null;
  }

  /**
   * Get all registered Guardians
   * @returns {Array} Guardian records
   */
  getAll() {
    return Array.from(this.guardians.values());
  }

  /**
   * Get Guardians by category
   * @param {string} category - Guardian category
   * @returns {Array} Guardian records
   */
  getByCategory(category) {
    return Array.from(this.guardians.values()).filter((r) => r.category === category);
  }

  /**
   * Get enabled Guardians
   * @returns {Array} Guardian records
   */
  getEnabled() {
    return Array.from(this.guardians.values()).filter((r) => r.enabled);
  }

  /**
   * Get required Guardians for action
   * @param {Array} guardian_ids - Guardian IDs
   * @returns {Array} Guardian records
   */
  getRequiredGuardians(guardian_ids) {
    return guardian_ids
      .map((id) => this.guardians.get(id))
      .filter((r) => r && r.enabled);
  }

  /**
   * Update Guardian health status
   * @param {string} guardian_id - Guardian ID
   * @param {Object} health - Health status
   */
  updateHealth(guardian_id, health) {
    const record = this.guardians.get(guardian_id);
    if (record) {
      record.health_status = health.status || 'unknown';
      record.last_health_check = Date.now();
      this._emitEvent('guardian_health_changed', {
        guardian_id,
        health_status: record.health_status
      });
    }
  }

  /**
   * Enable Guardian
   * @param {string} guardian_id - Guardian ID
   */
  enable(guardian_id) {
    const record = this.guardians.get(guardian_id);
    if (record) {
      record.enabled = true;
      this._emitEvent('guardian_enabled', { guardian_id });
    }
  }

  /**
   * Disable Guardian
   * @param {string} guardian_id - Guardian ID
   */
  disable(guardian_id) {
    const record = this.guardians.get(guardian_id);
    if (record) {
      record.enabled = false;
      this._emitEvent('guardian_disabled', { guardian_id });
    }
  }

  /**
   * Unregister Guardian
   * @param {string} guardian_id - Guardian ID
   */
  unregister(guardian_id) {
    this.guardians.delete(guardian_id);
    this._emitEvent('guardian_unregistered', { guardian_id });
  }

  /**
   * Get registry statistics
   * @returns {Object} statistics
   */
  getStats() {
    const all = Array.from(this.guardians.values());
    return {
      total: all.length,
      enabled: all.filter((r) => r.enabled).length,
      disabled: all.filter((r) => !r.enabled).length,
      healthy: all.filter((r) => r.health_status === 'healthy').length,
      degraded: all.filter((r) => r.health_status === 'degraded').length,
      unhealthy: all.filter((r) => r.health_status === 'unhealthy').length,
      by_category: this._groupByCategory(all),
      by_status: this._groupByStatus(all)
    };
  }

  /**
   * Private: Emit event
   * @private
   */
  _emitEvent(type, data = {}) {
    if (this.onEvent) {
      this.onEvent({
        type: `guardian.${type}`,
        ...data,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Private: Group Guardians by category
   * @private
   */
  _groupByCategory(records) {
    const groups = {};
    records.forEach((r) => {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r.guardian_id);
    });
    return groups;
  }

  /**
   * Private: Group Guardians by status
   * @private
   */
  _groupByStatus(records) {
    return {
      mock: records
        .filter((r) => r.implementation_status === 'mock')
        .map((r) => r.guardian_id),
      adapter_stub: records
        .filter((r) => r.implementation_status === 'adapter_stub')
        .map((r) => r.guardian_id),
      development: records
        .filter((r) => r.implementation_status === 'development')
        .map((r) => r.guardian_id),
      verified: records
        .filter((r) => r.implementation_status === 'verified')
        .map((r) => r.guardian_id)
    };
  }
}

module.exports = GuardianRegistry;
