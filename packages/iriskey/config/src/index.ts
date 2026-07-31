/**
 * IrisKey Platform - Configuration Management
 * Single source of truth for all application configuration
 */

import { z } from 'zod';
import type { AppConfig, AuthConfig, DatabaseConfig } from '@iriskey/contracts';

// Configuration schema for validation
const configSchema = z.object({
  // Product
  PRODUCT_ID: z.string().min(1, 'PRODUCT_ID is required'),
  PRODUCT_NAME: z.string().min(1, 'PRODUCT_NAME is required'),

  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DB_MAX_CONNECTIONS: z.string().optional().default('10'),
  DB_MIN_CONNECTIONS: z.string().optional().default('2'),

  // Auth
  NEXTAUTH_SECRET: z.string().min(1, 'NEXTAUTH_SECRET is required'),
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL'),
  JWT_EXPIRES_IN: z.string().optional().default('30d'),
  PASSWORD_HASH_ROUNDS: z.string().optional().default('12'),
  EMAIL_VERIFICATION_EXPIRES_IN: z.string().optional().default('24h'),
  PASSWORD_RESET_EXPIRES_IN: z.string().optional().default('1h'),

  // Redis
  REDIS_URL: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),

  // API
  API_BASE_URL: z.string().url('API_BASE_URL must be a valid URL').optional(),

  // Providers
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
});

type ConfigInput = z.infer<typeof configSchema>;

/**
 * Parses and validates configuration from environment variables
 */
function parseConfig(env: Record<string, string | undefined>): ConfigInput {
  const result = configSchema.safeParse(env);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  return result.data;
}

/**
 * Application configuration singleton
 */
class Configuration {
  private static instance: Configuration;
  private config: AppConfig;
  private rawEnv: ConfigInput;

  private constructor(env: ConfigInput) {
    this.rawEnv = env;
    this.config = this.buildConfig(env);
  }

  /**
   * Initialize configuration from environment variables
   */
  static initialize(env: Record<string, string | undefined> = process.env): Configuration {
    if (!Configuration.instance) {
      const parsedConfig = parseConfig(env);
      Configuration.instance = new Configuration(parsedConfig);
    }
    return Configuration.instance;
  }

  /**
   * Get singleton instance
   */
  static getInstance(): Configuration {
    if (!Configuration.instance) {
      Configuration.instance = Configuration.initialize();
    }
    return Configuration.instance;
  }

  /**
   * Build application config from environment
   */
  private buildConfig(env: ConfigInput): AppConfig {
    const environment = env.NODE_ENV as 'development' | 'production' | 'test';
    const isDevelopment = environment === 'development';
    const isProduction = environment === 'production';

    return {
      productId: env.PRODUCT_ID,
      productName: env.PRODUCT_NAME,
      environment,
      isDevelopment,
      isProduction,
      baseUrl: env.NEXTAUTH_URL,
      apiBaseUrl: env.API_BASE_URL || env.NEXTAUTH_URL,
      databaseUrl: env.DATABASE_URL,
      redisUrl: env.REDIS_URL,
      jwtSecret: env.NEXTAUTH_SECRET,
      jwtExpiresIn: env.JWT_EXPIRES_IN,
      emailProvider: 'resend', // Default provider
      storageProvider: 's3', // Default provider
      logLevel: env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error',
    };
  }

  /**
   * Get complete application config
   */
  getAppConfig(): AppConfig {
    return this.config;
  }

  /**
   * Get database configuration
   */
  getDatabaseConfig(): DatabaseConfig {
    return {
      url: this.rawEnv.DATABASE_URL,
      maxConnections: parseInt(this.rawEnv.DB_MAX_CONNECTIONS || '10', 10),
      minConnections: parseInt(this.rawEnv.DB_MIN_CONNECTIONS || '2', 10),
      connectionTimeoutMs: 10000,
      poolIdleTimeoutMs: 30000,
    };
  }

  /**
   * Get authentication configuration
   */
  getAuthConfig(): AuthConfig {
    return {
      jwtSecret: this.rawEnv.NEXTAUTH_SECRET,
      jwtExpiresIn: this.rawEnv.JWT_EXPIRES_IN,
      passwordHashRounds: parseInt(this.rawEnv.PASSWORD_HASH_ROUNDS || '12', 10),
      emailVerificationExpiresIn: this.parseTimeToMs(this.rawEnv.EMAIL_VERIFICATION_EXPIRES_IN),
      passwordResetExpiresIn: this.parseTimeToMs(this.rawEnv.PASSWORD_RESET_EXPIRES_IN),
      sessionMaxAge: 30 * 24 * 60 * 60, // 30 days in seconds
      cookieMaxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
    };
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(featureName: string): boolean {
    const envKey = `FEATURE_${featureName.toUpperCase()}`;
    const value = process.env[envKey];
    return value === 'true' || value === '1';
  }

  /**
   * Get product ID
   */
  getProductId(): string {
    return this.config.productId;
  }

  /**
   * Get product name
   */
  getProductName(): string {
    return this.config.productName;
  }

  /**
   * Check if running in development
   */
  isDev(): boolean {
    return this.config.isDevelopment;
  }

  /**
   * Check if running in production
   */
  isProd(): boolean {
    return this.config.isProduction;
  }

  /**
   * Get log level
   */
  getLogLevel(): string {
    return this.config.logLevel;
  }

  /**
   * Convert time string to milliseconds (e.g., "24h" -> 86400000)
   */
  private parseTimeToMs(timeStr: string): number {
    const match = timeStr.match(/^(\d+)([dhms])$/);
    if (!match) return 86400000; // Default to 24 hours

    const [, value, unit] = match;
    const num = parseInt(value, 10);

    switch (unit) {
      case 'd':
        return num * 24 * 60 * 60 * 1000;
      case 'h':
        return num * 60 * 60 * 1000;
      case 'm':
        return num * 60 * 1000;
      case 's':
        return num * 1000;
      default:
        return 86400000;
    }
  }
}

/**
 * Get the configuration instance
 */
export function getConfig(): AppConfig {
  return Configuration.getInstance().getAppConfig();
}

/**
 * Get product ID from configuration
 */
export function getProductId(): string {
  return Configuration.getInstance().getProductId();
}

/**
 * Get product name from configuration
 */
export function getProductName(): string {
  return Configuration.getInstance().getProductName();
}

/**
 * Get database configuration
 */
export function getDatabaseConfig(): DatabaseConfig {
  return Configuration.getInstance().getDatabaseConfig();
}

/**
 * Get authentication configuration
 */
export function getAuthConfig(): AuthConfig {
  return Configuration.getInstance().getAuthConfig();
}

/**
 * Check if feature is enabled
 */
export function isFeatureEnabled(featureName: string): boolean {
  return Configuration.getInstance().isFeatureEnabled(featureName);
}

/**
 * Initialize configuration
 */
export function initializeConfig(env?: Record<string, string | undefined>): void {
  Configuration.initialize(env);
}

/**
 * Export Configuration class for testing
 */
export { Configuration };
