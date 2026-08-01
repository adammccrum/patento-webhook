/**
 * Monitoring package tests
 */

import { StructuredLogger, HealthCheckService, LogLevel } from './src/index';

describe('@iriskey/monitoring', () => {
  describe('StructuredLogger', () => {
    const logger = new StructuredLogger({
      minLevel: LogLevel.DEBUG,
      prettyPrint: true,
    });

    it('logs debug messages', () => {
      expect(() => {
        logger.debug('Test debug message');
      }).not.toThrow();
    });

    it('logs info messages', () => {
      expect(() => {
        logger.info('Test info message');
      }).not.toThrow();
    });

    it('logs warning messages', () => {
      expect(() => {
        logger.warn('Test warning message');
      }).not.toThrow();
    });

    it('logs error messages', () => {
      expect(() => {
        logger.error('Test error message');
      }).not.toThrow();
    });

    it('logs with context', () => {
      expect(() => {
        logger.info('User action', {
          context: {
            userId: 'user-123',
            action: 'login',
          },
        });
      }).not.toThrow();
    });
  });

  describe('HealthCheckService', () => {
    it('registers health checks', async () => {
      const healthCheck = new HealthCheckService();

      healthCheck.registerCheck('database', async () => ({
        status: 'healthy',
        details: { connected: true },
      }));

      const health = await healthCheck.getHealth();
      expect(health.checks.database).toBeDefined();
    });

    it('marks service as healthy when all checks pass', async () => {
      const healthCheck = new HealthCheckService();

      healthCheck.registerCheck('test', async () => ({
        ok: true,
      }));

      const health = await healthCheck.getHealth();
      expect(health.status).toBe('healthy');
    });

    it('marks service as unhealthy when some checks fail', async () => {
      const healthCheck = new HealthCheckService();

      healthCheck.registerCheck('ok', async () => ({
        ok: true,
      }));

      healthCheck.registerCheck('bad', async () => ({
        ok: false,
      }));

      const health = await healthCheck.getHealth();
      expect(health.status).toBe('unhealthy');
    });

    it('provides readiness check', async () => {
      const healthCheck = new HealthCheckService();

      healthCheck.registerCheck('database', async () => ({
        ok: true,
      }));

      const readiness = await healthCheck.getReadiness();
      expect(readiness.ready).toBe(true);
    });

    it('provides liveness check', async () => {
      const healthCheck = new HealthCheckService();
      const liveness = await healthCheck.getLiveness();
      expect(liveness.alive).toBe(true);
      expect(liveness.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('LogLevel', () => {
    it('has required log levels', () => {
      expect(LogLevel.DEBUG).toBe('debug');
      expect(LogLevel.INFO).toBe('info');
      expect(LogLevel.WARN).toBe('warn');
      expect(LogLevel.ERROR).toBe('error');
    });
  });
});
