/**
 * Base provider adapter interface
 * All providers must implement this interface
 */

const logger = require('../utils/logger');
const { PROVIDER_HEALTH } = require('../utils/constants');

class ProviderAdapter {
  constructor(config = {}) {
    this.id = config.id || 'unknown';
    this.name = config.name || 'Unknown Provider';
    this.category = config.category;
    this.capabilities = config.capabilities || [];
    this.enabled = config.enabled !== false;
    this.health = PROVIDER_HEALTH.UNKNOWN;
    this.lastChecked = null;
    this.costTracker = {
      total: 0,
      calls: 0,
      lastReset: new Date().toISOString()
    };
  }

  /**
   * Check if adapter can handle a capability
   */
  async canHandle(capability) {
    return this.capabilities.includes(capability);
  }

  /**
   * Health check - must be implemented by subclasses
   */
  async healthCheck() {
    // Subclasses should override this
    this.health = PROVIDER_HEALTH.HEALTHY;
    this.lastChecked = new Date().toISOString();
    return this.health;
  }

  /**
   * Get provider metadata
   */
  async getMetadata() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      capabilities: this.capabilities,
      enabled: this.enabled,
      health: this.health,
      lastChecked: this.lastChecked,
      costTracker: this.costTracker
    };
  }

  /**
   * Track cost of an operation
   */
  async trackCost(operation, units, costPerUnit) {
    const cost = units * costPerUnit;
    this.costTracker.total += cost;
    this.costTracker.calls += 1;

    logger.debug({
      adapter: this.id,
      operation,
      units,
      cost,
      totalCost: this.costTracker.total
    });

    return cost;
  }

  /**
   * Reset cost tracker (for monthly billing cycles)
   */
  resetCostTracker() {
    this.costTracker = {
      total: 0,
      calls: 0,
      lastReset: new Date().toISOString()
    };
  }
}

module.exports = ProviderAdapter;
