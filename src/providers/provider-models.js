/**
 * Provider data models and types
 */

const { PROVIDER_HEALTH } = require('../utils/constants');

/**
 * Provider definition schema - 14 required fields
 */
class ProviderDefinition {
  constructor(data) {
    this.provider_id = data.provider_id;                // Unique identifier
    this.name = data.name;                              // Human-readable name
    this.category = data.category;                      // voice, media, agents, etc.
    this.repository = data.repository || '';            // GitHub URL
    this.licence = data.licence || 'Unknown';           // License type
    this.adapter = data.adapter || null;                // Adapter class name
    this.enabled = data.enabled === true;               // Is provider active? (default: false)
    this.installed = data.installed === true;           // Is provider installed?
    this.configured = data.configured === true;         // Is provider configured?
    this.execution_mode = data.execution_mode || 'local'; // local, cloud, hybrid
    this.GPU_requirement = data.GPU_requirement === true; // Does it need GPU?
    this.health_status = data.health_status || PROVIDER_HEALTH.UNKNOWN;
    this.last_tested = data.last_tested || null;        // ISO timestamp
    this.cost_classification = data.cost_classification || 'unknown'; // free, paid, etc.
  }

  /**
   * Validate provider definition
   */
  static validate(data) {
    const errors = [];
    if (!data.provider_id) errors.push('Missing required field: provider_id');
    if (!data.name) errors.push('Missing required field: name');
    if (!data.category) errors.push('Missing required field: category');
    return {
      valid: errors.length === 0,
      errors
    };
  }

  toJSON() {
    return {
      provider_id: this.provider_id,
      name: this.name,
      category: this.category,
      repository: this.repository,
      licence: this.licence,
      adapter: this.adapter,
      enabled: this.enabled,
      installed: this.installed,
      configured: this.configured,
      execution_mode: this.execution_mode,
      GPU_requirement: this.GPU_requirement,
      health_status: this.health_status,
      last_tested: this.last_tested,
      cost_classification: this.cost_classification
    };
  }
}

module.exports = {
  ProviderDefinition
};
