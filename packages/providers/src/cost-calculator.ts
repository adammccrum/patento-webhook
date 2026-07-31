/**
 * Cost calculator for provider operations
 */

import { CostMetadata, IProvider } from './types';

/**
 * Cost calculator for managing credit usage
 */
export class CostCalculator {
  /**
   * Calculate total cost for multiple providers
   */
  async calculateTotalCost(
    providers: IProvider[],
    operation: string,
    metadata: CostMetadata
  ): Promise<Map<string, number>> {
    const costs = new Map<string, number>();

    const estimates = await Promise.all(
      providers.map((p) =>
        p.estimateCost(operation, metadata as Record<string, any>).catch(() => 0)
      )
    );

    providers.forEach((p, i) => {
      costs.set(p.id, estimates[i]);
    });

    return costs;
  }

  /**
   * Get cheapest provider for operation
   */
  async findCheapestProvider(
    providers: IProvider[],
    operation: string,
    metadata: CostMetadata
  ): Promise<{ provider: IProvider; cost: number } | null> {
    const costs = await this.calculateTotalCost(providers, operation, metadata);

    let cheapest: { provider: IProvider; cost: number } | null = null;

    for (const [providerId, cost] of costs.entries()) {
      const provider = providers.find((p) => p.id === providerId);
      if (provider && (!cheapest || cost < cheapest.cost)) {
        cheapest = { provider, cost };
      }
    }

    return cheapest;
  }

  /**
   * Get fastest provider (estimated)
   */
  findFastestProvider(providers: IProvider[]): IProvider | null {
    if (providers.length === 0) {
      return null;
    }

    const capabilities = providers
      .map((p) => ({
        provider: p,
        latency: p.getCapabilities().estimatedLatency || Infinity,
      }))
      .sort((a, b) => a.latency - b.latency);

    return capabilities[0].provider;
  }

  /**
   * Get best provider based on criteria
   */
  async getBestProvider(
    providers: IProvider[],
    operation: string,
    metadata: CostMetadata,
    criteria: {
      prioritizeCost?: boolean;
      prioritizeSpeed?: boolean;
      prioritizeQuality?: boolean;
      maxCost?: number;
    } = {}
  ): Promise<IProvider | null> {
    if (providers.length === 0) {
      return null;
    }

    if (providers.length === 1) {
      return providers[0];
    }

    // Default: balance cost and speed
    if (criteria.prioritizeCost) {
      const cheapest = await this.findCheapestProvider(providers, operation, metadata);
      return cheapest?.provider || null;
    }

    if (criteria.prioritizeSpeed) {
      return this.findFastestProvider(providers);
    }

    // Balance approach: cheaper is better if under maxCost
    const cheapest = await this.findCheapestProvider(providers, operation, metadata);
    if (cheapest && (!criteria.maxCost || cheapest.cost <= criteria.maxCost)) {
      return cheapest.provider;
    }

    // Fallback to fastest
    return this.findFastestProvider(providers);
  }

  /**
   * Format cost as user-friendly string
   */
  formatCost(credits: number): string {
    if (credits < 1) {
      return '< 1 credit';
    }
    if (credits >= 1000000) {
      return `${(credits / 1000000).toFixed(2)}M credits`;
    }
    if (credits >= 1000) {
      return `${(credits / 1000).toFixed(2)}K credits`;
    }
    return `${Math.round(credits)} credits`;
  }
}

export const costCalculator = new CostCalculator();
