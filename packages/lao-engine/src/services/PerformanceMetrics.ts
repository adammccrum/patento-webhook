/**
 * Performance Metrics - Measure baseline performance.
 *
 * Metrics collected:
 * - Command execution time (ms)
 * - Event publishing latency (ms)
 * - Aggregate reconstruction time (ms)
 * - Projection rebuild time (ms)
 * - Memory usage (bytes)
 * - Repository performance (find, save, query times)
 *
 * No optimization without measurements.
 * Capture baseline numbers now for future comparison.
 */

export interface PerformanceMetric {
  operation: string;
  duration: number; // milliseconds
  timestamp: string;
  aggregateId?: string;
  eventCount?: number;
  memoryUsageMB?: number;
  details?: Record<string, unknown>;
}

export interface PerformanceReport {
  operation: string;
  count: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  stdDev: number;
  p50: number; // 50th percentile
  p95: number; // 95th percentile
  p99: number; // 99th percentile
}

/**
 * MetricsCollector - Accumulates performance measurements.
 */
export class MetricsCollector {
  private metrics: PerformanceMetric[] = [];

  /**
   * Record a metric.
   */
  record(metric: PerformanceMetric): void {
    this.metrics.push(metric);
  }

  /**
   * Record operation timing.
   */
  recordOperation(
    operation: string,
    duration: number,
    details?: {
      aggregateId?: string;
      eventCount?: number;
      memoryUsageMB?: number;
      [key: string]: unknown;
    }
  ): void {
    const memUsage = process.memoryUsage();
    this.metrics.push({
      operation,
      duration,
      timestamp: new Date().toISOString(),
      aggregateId: details?.aggregateId as string | undefined,
      eventCount: details?.eventCount as number | undefined,
      memoryUsageMB: Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100,
      details,
    });
  }

  /**
   * Get all metrics.
   */
  getAllMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Generate performance report by operation type.
   */
  generateReport(): PerformanceReport[] {
    const grouped = new Map<string, PerformanceMetric[]>();

    // Group by operation
    for (const metric of this.metrics) {
      if (!grouped.has(metric.operation)) {
        grouped.set(metric.operation, []);
      }
      grouped.get(metric.operation)!.push(metric);
    }

    // Generate reports
    const reports: PerformanceReport[] = [];

    for (const [operation, metrics] of grouped) {
      const durations = metrics.map((m) => m.duration).sort((a, b) => a - b);
      const count = durations.length;
      const sum = durations.reduce((a, b) => a + b, 0);
      const avg = sum / count;

      // Calculate standard deviation
      const squaredDiffs = durations.map((d) => Math.pow(d - avg, 2));
      const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / count;
      const stdDev = Math.sqrt(avgSquaredDiff);

      // Calculate percentiles
      const p50Index = Math.floor(count * 0.5);
      const p95Index = Math.floor(count * 0.95);
      const p99Index = Math.floor(count * 0.99);

      reports.push({
        operation,
        count,
        avgDuration: Math.round(avg * 100) / 100,
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        stdDev: Math.round(stdDev * 100) / 100,
        p50: durations[p50Index] || 0,
        p95: durations[p95Index] || 0,
        p99: durations[p99Index] || 0,
      });
    }

    return reports.sort((a, b) => b.avgDuration - a.avgDuration);
  }

  /**
   * Get metrics for specific operation.
   */
  getOperationMetrics(operation: string): PerformanceMetric[] {
    return this.metrics.filter((m) => m.operation === operation);
  }

  /**
   * Clear all metrics.
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Export metrics as JSON.
   */
  toJSON(): PerformanceMetric[] {
    return this.metrics;
  }
}

/**
 * TimingDecorator - Measure operation duration.
 * Usage: const duration = await measureTime(async () => { ... })
 */
export async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

/**
 * Synchronous version.
 */
export function measureTimeSync<T>(fn: () => T): { result: T; duration: number } {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  return { result, duration };
}
