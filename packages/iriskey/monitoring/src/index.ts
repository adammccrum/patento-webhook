/**
 * IrisKey Platform - Monitoring Package
 * Sentry integration, structured logging, health checks
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Structured logging levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Structured log entry
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  duration?: number;
  userId?: string;
  productId?: string;
  requestId?: string;
  ipAddress?: string;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  minLevel?: LogLevel;
  prettyPrint?: boolean;
  sentryDsn?: string;
  environment?: string;
  release?: string;
}

/**
 * Structured Logger
 */
export class StructuredLogger {
  private minLevel: LogLevel;
  private prettyPrint: boolean;
  private sentryClient?: any;

  constructor(config: LoggerConfig = {}) {
    this.minLevel = config.minLevel || LogLevel.INFO;
    this.prettyPrint = config.prettyPrint ?? process.env.NODE_ENV === 'development';

    if (config.sentryDsn) {
      this.initSentry(config.sentryDsn, {
        environment: config.environment,
        release: config.release,
      });
    }
  }

  private initSentry(dsn: string, options: any) {
    // Sentry initialization would happen here
    // For now, this is a placeholder for the actual Sentry integration
    console.log('Sentry initialized with DSN:', dsn);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private formatLog(entry: LogEntry): string {
    if (this.prettyPrint) {
      return JSON.stringify(entry, null, 2);
    }
    return JSON.stringify(entry);
  }

  private log(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    const formatted = this.formatLog(entry);

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
        console.error(formatted);
        if (this.sentryClient) {
          // Send to Sentry
          // this.sentryClient.captureException(entry.error);
        }
        break;
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      message,
      context,
    });
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      message,
      context,
    });
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      message,
      context,
    });
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      message,
      context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    });
  }

  request(
    method: string,
    path: string,
    duration: number,
    statusCode: number,
    context?: Record<string, unknown>
  ): void {
    this.info(`${method} ${path} ${statusCode}`, {
      method,
      path,
      statusCode,
      duration,
      ...context,
    });
  }
}

/**
 * Global logger instance
 */
let globalLogger: StructuredLogger | null = null;

/**
 * Initialize global logger
 */
export function initializeLogger(config: LoggerConfig): StructuredLogger {
  if (!globalLogger) {
    globalLogger = new StructuredLogger(config);
  }
  return globalLogger;
}

/**
 * Get global logger
 */
export function getLogger(): StructuredLogger {
  if (!globalLogger) {
    globalLogger = new StructuredLogger();
  }
  return globalLogger;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: Record<string, {
    status: 'ok' | 'warning' | 'error';
    message?: string;
  }>;
}

/**
 * Readiness check response
 */
export interface ReadinessCheckResponse {
  ready: boolean;
  timestamp: string;
  checks: Record<string, {
    ready: boolean;
    message?: string;
  }>;
}

/**
 * Liveness check response
 */
export interface LivenessCheckResponse {
  alive: boolean;
  timestamp: string;
  uptime: number;
}

/**
 * Health check service
 */
export class HealthCheckService {
  private startTime = Date.now();
  private checks: Map<string, () => Promise<{ ok: boolean; message?: string }>> = new Map();

  /**
   * Register a health check
   */
  registerCheck(
    name: string,
    check: () => Promise<{ ok: boolean; message?: string }>
  ): void {
    this.checks.set(name, check);
  }

  /**
   * Get health status
   */
  async getHealth(): Promise<HealthCheckResponse> {
    const checkResults: Record<
      string,
      { status: 'ok' | 'warning' | 'error'; message?: string }
    > = {};

    for (const [name, check] of this.checks) {
      try {
        const result = await check();
        checkResults[name] = {
          status: result.ok ? 'ok' : 'error',
          message: result.message,
        };
      } catch (error) {
        checkResults[name] = {
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    const hasErrors = Object.values(checkResults).some(
      (check) => check.status === 'error'
    );

    return {
      status: hasErrors ? 'unhealthy' : 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      checks: checkResults,
    };
  }

  /**
   * Get readiness status
   */
  async getReadiness(): Promise<ReadinessCheckResponse> {
    const checkResults: Record<string, { ready: boolean; message?: string }> = {};

    for (const [name, check] of this.checks) {
      try {
        const result = await check();
        checkResults[name] = {
          ready: result.ok,
          message: result.message,
        };
      } catch (error) {
        checkResults[name] = {
          ready: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    const allReady = Object.values(checkResults).every((check) => check.ready);

    return {
      ready: allReady,
      timestamp: new Date().toISOString(),
      checks: checkResults,
    };
  }

  /**
   * Get liveness status
   */
  getLiveness(): LivenessCheckResponse {
    return {
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
    };
  }
}

/**
 * Global health check service
 */
let globalHealthCheckService: HealthCheckService | null = null;

/**
 * Initialize global health check service
 */
export function initializeHealthCheckService(): HealthCheckService {
  if (!globalHealthCheckService) {
    globalHealthCheckService = new HealthCheckService();
  }
  return globalHealthCheckService;
}

/**
 * Get global health check service
 */
export function getHealthCheckService(): HealthCheckService {
  if (!globalHealthCheckService) {
    globalHealthCheckService = new HealthCheckService();
  }
  return globalHealthCheckService;
}

/**
 * Health check endpoint handler
 */
export async function handleHealthCheck(request: NextRequest): Promise<NextResponse> {
  const healthService = getHealthCheckService();
  const health = await healthService.getHealth();

  const statusCode = health.status === 'healthy' ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}

/**
 * Readiness endpoint handler
 */
export async function handleReadinessCheck(request: NextRequest): Promise<NextResponse> {
  const healthService = getHealthCheckService();
  const readiness = await healthService.getReadiness();

  const statusCode = readiness.ready ? 200 : 503;

  return NextResponse.json(readiness, { status: statusCode });
}

/**
 * Liveness endpoint handler
 */
export async function handleLivenessCheck(request: NextRequest): Promise<NextResponse> {
  const healthService = getHealthCheckService();
  const liveness = healthService.getLiveness();

  return NextResponse.json(liveness, { status: 200 });
}

/**
 * Request context for logging
 */
export interface RequestContext {
  requestId: string;
  userId?: string;
  productId?: string;
  ipAddress?: string;
  userAgent?: string;
  duration?: number;
  statusCode?: number;
}

/**
 * Create request context
 */
export function createRequestContext(request: NextRequest, userId?: string, productId?: string): RequestContext {
  return {
    requestId: crypto.randomUUID(),
    userId,
    productId,
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}
