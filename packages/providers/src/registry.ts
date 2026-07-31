/**
 * Provider Registry
 * Manages all available providers and their configurations
 */

import { IProvider, ProviderConfig, ProviderHealth, ProviderMetrics, ProviderType } from './types';

/**
 * Provider registry for managing available providers
 */
export class ProviderRegistry {
  private providers: Map<string, IProvider> = new Map();
  private configs: Map<string, ProviderConfig> = new Map();
  private metrics: Map<string, ProviderMetrics> = new Map();

  /**
   * Register a provider
   */
  register(provider: IProvider, config: ProviderConfig): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`Provider ${provider.id} already registered`);
    }
    this.providers.set(provider.id, provider);
    this.configs.set(provider.id, config);
  }

  /**
   * Unregister a provider
   */
  unregister(providerId: string): void {
    this.providers.delete(providerId);
    this.configs.delete(providerId);
    this.metrics.delete(providerId);
  }

  /**
   * Get a provider by ID
   */
  get(providerId: string): IProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Get provider config by ID
   */
  getConfig(providerId: string): ProviderConfig | undefined {
    return this.configs.get(providerId);
  }

  /**
   * Get all providers of a specific type
   */
  getByType(type: ProviderType): IProvider[] {
    return Array.from(this.providers.values()).filter((p) => p.type === type);
  }

  /**
   * Get enabled providers of a specific type, sorted by priority
   */
  getEnabledByType(type: ProviderType): IProvider[] {
    return this.getByType(type)
      .filter((p) => {
        const config = this.configs.get(p.id);
        return config?.enabled;
      })
      .sort((a, b) => {
        const configA = this.configs.get(a.id)!;
        const configB = this.configs.get(b.id)!;
        return configB.priority - configA.priority;
      });
  }

  /**
   * Get all registered providers
   */
  getAll(): IProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get all enabled providers
   */
  getAllEnabled(): IProvider[] {
    return this.getAll().filter((p) => {
      const config = this.configs.get(p.id);
      return config?.enabled;
    });
  }

  /**
   * Check health of a provider and update metrics
   */
  async checkHealth(providerId: string): Promise<ProviderHealth> {
    const provider = this.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    const health = await provider.health();
    this.updateMetrics(providerId, health);
    return health;
  }

  /**
   * Check health of all providers
   */
  async checkAllHealth(): Promise<Map<string, ProviderHealth>> {
    const results = new Map<string, ProviderHealth>();
    const promises = Array.from(this.providers.keys()).map(async (id) => {
      try {
        const health = await this.checkHealth(id);
        results.set(id, health);
      } catch (error) {
        results.set(id, ProviderHealth.UNKNOWN);
      }
    });
    await Promise.all(promises);
    return results;
  }

  /**
   * Get metrics for a provider
   */
  getMetrics(providerId: string): ProviderMetrics | undefined {
    return this.metrics.get(providerId);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): ProviderMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Update metrics for a provider
   */
  private updateMetrics(providerId: string, health: ProviderHealth): void {
    const metrics = this.metrics.get(providerId) || {
      providerId,
      timestamp: new Date(),
      health: ProviderHealth.UNKNOWN,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      errorRate: 0,
    };

    metrics.health = health;
    metrics.timestamp = new Date();
    this.metrics.set(providerId, metrics);
  }

  /**
   * Record a successful request
   */
  recordSuccess(providerId: string, latency: number): void {
    const metrics = this.metrics.get(providerId);
    if (metrics) {
      metrics.totalRequests++;
      metrics.successfulRequests++;
      metrics.averageLatency =
        (metrics.averageLatency * (metrics.totalRequests - 1) + latency) /
        metrics.totalRequests;
      metrics.errorRate = metrics.failedRequests / metrics.totalRequests;
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(providerId: string, error: string): void {
    const metrics = this.metrics.get(providerId);
    if (metrics) {
      metrics.totalRequests++;
      metrics.failedRequests++;
      metrics.lastError = error;
      metrics.errorRate = metrics.failedRequests / metrics.totalRequests;
    }
  }
}

export const registry = new ProviderRegistry();
