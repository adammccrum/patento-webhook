/**
 * AI Router
 * Routes requests to the best available provider based on criteria
 */

import { CostCalculator } from './cost-calculator';
import { ProviderRegistry } from './registry';
import {
  CostMetadata,
  IProvider,
  ProviderHealth,
  ProviderType,
} from './types';

/**
 * Router configuration
 */
export interface RouterConfig {
  prioritizeCost?: boolean;
  prioritizeSpeed?: boolean;
  prioritizeQuality?: boolean;
  maxCost?: number;
  failover?: boolean;
  maxRetries?: number;
}

/**
 * Router result
 */
export interface RouterResult<T = any> {
  success: boolean;
  providerId: string;
  providerName: string;
  data?: T;
  cost: number;
  latency: number;
  error?: string;
}

/**
 * AI Router for managing provider selection and fallback
 */
export class AIRouter {
  private registry: ProviderRegistry;
  private costCalculator: CostCalculator;
  private config: RouterConfig;

  constructor(
    registry: ProviderRegistry,
    costCalculator: CostCalculator,
    config: RouterConfig = {}
  ) {
    this.registry = registry;
    this.costCalculator = costCalculator;
    this.config = {
      failover: true,
      maxRetries: 3,
      ...config,
    };
  }

  /**
   * Get best provider for operation
   */
  async selectProvider(
    type: ProviderType,
    operation: string,
    metadata: CostMetadata = {}
  ): Promise<IProvider> {
    const providers = this.registry.getEnabledByType(type);

    if (providers.length === 0) {
      throw new Error(`No enabled providers found for type ${type}`);
    }

    // Filter out unhealthy providers
    const healthyProviders = await this.filterHealthyProviders(providers);

    if (healthyProviders.length === 0) {
      throw new Error(`No healthy providers found for type ${type}`);
    }

    const best = await this.costCalculator.getBestProvider(
      healthyProviders,
      operation,
      metadata,
      this.config
    );

    if (!best) {
      throw new Error(`Could not select provider for type ${type}`);
    }

    return best;
  }

  /**
   * Get all available providers for type
   */
  getAvailableProviders(type: ProviderType): IProvider[] {
    return this.registry.getEnabledByType(type);
  }

  /**
   * Get provider by ID
   */
  getProvider(providerId: string): IProvider | undefined {
    return this.registry.get(providerId);
  }

  /**
   * Filter out unhealthy providers
   */
  private async filterHealthyProviders(providers: IProvider[]): Promise<IProvider[]> {
    const healthChecks = await Promise.all(
      providers.map(async (p) => {
        try {
          const health = await this.registry.checkHealth(p.id);
          return health !== ProviderHealth.UNHEALTHY ? p : null;
        } catch {
          return null;
        }
      })
    );

    return healthChecks.filter((p): p is IProvider => p !== null);
  }

  /**
   * Get provider metrics
   */
  getMetrics(providerId?: string) {
    if (providerId) {
      return this.registry.getMetrics(providerId);
    }
    return this.registry.getAllMetrics();
  }

  /**
   * Check health of a provider
   */
  async checkProviderHealth(providerId: string): Promise<ProviderHealth> {
    return this.registry.checkHealth(providerId);
  }

  /**
   * Check health of all providers
   */
  async checkAllHealth(): Promise<Map<string, ProviderHealth>> {
    return this.registry.checkAllHealth();
  }

  /**
   * Estimate cost for operation
   */
  async estimateCost(
    type: ProviderType,
    operation: string,
    metadata: CostMetadata = {}
  ): Promise<Map<string, number>> {
    const providers = this.registry.getEnabledByType(type);
    return this.costCalculator.calculateTotalCost(
      providers,
      operation,
      metadata
    );
  }

  /**
   * Get cost summary for all available providers
   */
  async getCostSummary(
    type: ProviderType,
    operation: string,
    metadata: CostMetadata = {}
  ): Promise<{
    cheapest: { providerId: string; cost: number };
    mostExpensive: { providerId: string; cost: number };
    average: number;
  }> {
    const costs = await this.estimateCost(type, operation, metadata);

    const entries = Array.from(costs.entries());
    if (entries.length === 0) {
      throw new Error('No providers available for cost summary');
    }

    const sorted = entries.sort((a, b) => a[1] - b[1]);
    const total = sorted.reduce((sum, [, cost]) => sum + cost, 0);

    // sorted is non-empty here; entries was checked before this point.
    const cheapest = sorted[0]!;
    const mostExpensive = sorted[sorted.length - 1]!;

    return {
      cheapest: { providerId: cheapest[0], cost: cheapest[1] },
      mostExpensive: { providerId: mostExpensive[0], cost: mostExpensive[1] },
      average: total / sorted.length,
    };
  }
}
