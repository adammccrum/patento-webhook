'use strict';

/**
 * Base interface every provider adapter extends.
 * See docs/ADAPTER_SPECIFICATION.md
 */
class ProviderAdapter {
  constructor(config = {}) {
    this.config = config;
    this.id = config.id;
    this.name = config.name;
    this.category = config.category;
    this.capabilities = config.capabilities || [];
    this.enabled = config.enabled !== false;
    this.health = 'unknown';
    this.last_checked = null;
    this.cost_tracker = { total: 0, calls: 0 };
  }

  async canHandle(capability) {
    return this.capabilities.includes(capability);
  }

  async healthCheck() {
    throw new Error('healthCheck() must be implemented');
  }

  async getMetadata() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      capabilities: this.capabilities,
      enabled: this.enabled,
      health: this.health,
      cost: this.cost_tracker
    };
  }

  async trackCost(operation, units, costPerUnit) {
    const cost = units * costPerUnit;
    this.cost_tracker.total += cost;
    this.cost_tracker.calls += 1;
    return cost;
  }
}

module.exports = ProviderAdapter;
