/**
 * Provider registry - loads and manages all providers from configuration
 * No providers are instantiated until explicitly enabled and configured
 */

const logger = require('../utils/logger');
const { ProviderDefinition } = require('./provider-models');
const { ProviderUnavailableError } = require('../utils/errors');

class ProviderRegistry {
  constructor() {
    this.definitions = new Map();  // provider_id -> ProviderDefinition
    this.adapters = new Map();     // provider_id -> ProviderAdapter instance
    this.healthCheckInterval = null;
  }

  /**
   * Register a provider definition from config
   * Note: This does NOT instantiate the adapter, just registers the definition
   */
  registerProvider(definition) {
    const validation = ProviderDefinition.validate(definition);
    if (!validation.valid) {
      throw new Error(`Invalid provider definition: ${validation.errors.join(', ')}`);
    }

    const provider = new ProviderDefinition(definition);
    this.definitions.set(provider.provider_id, provider);

    if (provider.enabled) {
      logger.info(`Registered provider definition: ${provider.name} (${provider.provider_id})`);
    } else {
      logger.debug(`Registered provider definition (disabled): ${provider.name} (${provider.provider_id})`);
    }
  }

  /**
   * Register multiple provider definitions
   */
  registerProviders(definitions) {
    if (!Array.isArray(definitions)) {
      throw new Error('Definitions must be an array');
    }
    definitions.forEach(def => this.registerProvider(def));
  }

  /**
   * Instantiate and activate an adapter for an enabled provider
   */
  async activateAdapter(providerId, AdapterClass, config) {
    const definition = this.definitions.get(providerId);
    if (!definition) {
      throw new Error(`Provider ${providerId} not defined`);
    }

    if (!definition.enabled) {
      throw new Error(`Provider ${providerId} is not enabled`);
    }

    try {
      const adapter = new AdapterClass(config);
      const health = await adapter.healthCheck();

      this.adapters.set(providerId, adapter);

      // Update definition status
      definition.installed = true;
      definition.configured = true;
      definition.health_status = health;
      definition.last_tested = new Date().toISOString();

      logger.info(`Activated adapter: ${providerId} (${adapter.name})`);
      return adapter;
    } catch (error) {
      logger.error(`Failed to activate adapter ${providerId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get adapter by provider ID
   */
  getAdapter(providerId) {
    const adapter = this.adapters.get(providerId);
    if (!adapter) {
      throw new ProviderUnavailableError(providerId, `Adapter not loaded for provider ${providerId}`);
    }
    return adapter;
  }

  /**
   * Get adapter for a category and capability
   * Returns first healthy, enabled adapter that supports the capability
   */
  async getAdapterForCapability(category, capability) {
    const candidates = Array.from(this.definitions.values())
      .filter(p => p.category === category && p.enabled)
      .map(p => this.adapters.get(p.provider_id))
      .filter(a => a && a.capabilities.includes(capability))
      .sort((a, b) => {
        // Prefer healthy adapters
        const aHealthy = a.health === 'healthy' ? 0 : 1;
        const bHealthy = b.health === 'healthy' ? 0 : 1;
        if (aHealthy !== bHealthy) return aHealthy - bHealthy;

        // Then prefer cheaper providers
        return (a.costTracker?.total || 0) - (b.costTracker?.total || 0);
      });

    if (candidates.length === 0) {
      throw new ProviderUnavailableError(
        `${category}:${capability}`,
        `No adapter available for ${category}/${capability}`
      );
    }

    return candidates[0];
  }

  /**
   * Try adapters in fallback chain for a capability
   */
  async tryAdaptersForCapability(category, capability, operation, ...args) {
    const candidates = Array.from(this.definitions.values())
      .filter(p => p.category === category && p.enabled)
      .map(p => this.adapters.get(p.provider_id))
      .filter(a => a && a.capabilities.includes(capability));

    for (const adapter of candidates) {
      try {
        if (!adapter[operation]) {
          throw new Error(`Operation ${operation} not supported`);
        }
        const result = await adapter[operation](...args);
        return {
          providerId: adapter.id,
          result
        };
      } catch (error) {
        logger.warn(`Adapter ${adapter.id} failed for ${category}/${capability}: ${error.message}`);
        continue;
      }
    }

    throw new ProviderUnavailableError(
      `${category}:${capability}`,
      `All adapters failed for ${category}/${capability}`
    );
  }

  /**
   * Get all provider definitions
   */
  getDefinitions() {
    return Array.from(this.definitions.values());
  }

  /**
   * Get enabled provider definitions
   */
  getEnabledDefinitions() {
    return this.getDefinitions().filter(p => p.enabled);
  }

  /**
   * Get provider definition by ID
   */
  getDefinition(providerId) {
    return this.definitions.get(providerId);
  }

  /**
   * Get providers by category
   */
  getProvidersByCategory(category) {
    return this.getDefinitions().filter(p => p.category === category);
  }

  /**
   * Get status of all providers
   */
  getStatus() {
    return {
      timestamp: new Date().toISOString(),
      total_providers: this.definitions.size,
      enabled_providers: this.getEnabledDefinitions().length,
      active_adapters: this.adapters.size,
      providers: Array.from(this.definitions.values()).map(p => p.toJSON())
    };
  }

  /**
   * Start periodic health checks for active adapters
   */
  startHealthChecks(intervalMs = 60000) {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      for (const [providerId, adapter] of this.adapters.entries()) {
        try {
          const health = await adapter.healthCheck();
          const definition = this.definitions.get(providerId);
          if (definition) {
            definition.health_status = health;
            definition.last_tested = new Date().toISOString();
          }
        } catch (error) {
          logger.warn(`Health check failed for ${providerId}: ${error.message}`);
          const definition = this.definitions.get(providerId);
          if (definition) {
            definition.health_status = 'unhealthy';
            definition.last_tested = new Date().toISOString();
          }
        }
      }
    }, intervalMs);

    logger.info(`Started health checks every ${intervalMs}ms`);
  }

  /**
   * Stop health checks
   */
  stopHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Stopped health checks');
    }
  }

  /**
   * Validate all provider definitions
   */
  validate() {
    const errors = [];
    for (const [id, definition] of this.definitions.entries()) {
      const validation = ProviderDefinition.validate(definition);
      if (!validation.valid) {
        errors.push({ provider_id: id, errors: validation.errors });
      }
    }
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = ProviderRegistry;
