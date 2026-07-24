/**
 * Configuration loader - loads YAML and environment configurations
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const logger = require('../utils/logger');

class ConfigLoader {
  constructor(configDir = 'config') {
    this.configDir = configDir;
    this.agentsConfig = null;
    this.providersConfig = null;
    this.rbacConfig = null;
  }

  /**
   * Load agent configuration
   */
  loadAgentsConfig() {
    const configPath = path.join(this.configDir, 'agents.yaml');
    if (!fs.existsSync(configPath)) {
      throw new Error(`Agent configuration not found: ${configPath}`);
    }

    const content = fs.readFileSync(configPath, 'utf-8');
    const config = yaml.parse(content);

    if (!config.agents || !Array.isArray(config.agents)) {
      throw new Error('Invalid agents configuration: agents array missing');
    }

    logger.info(`Loaded ${config.agents.length} agent definitions from ${configPath}`);
    this.agentsConfig = config.agents;
    return config.agents;
  }

  /**
   * Load provider configuration
   */
  loadProvidersConfig() {
    const configPath = path.join(this.configDir, 'providers.yaml');
    if (!fs.existsSync(configPath)) {
      throw new Error(`Provider configuration not found: ${configPath}`);
    }

    const content = fs.readFileSync(configPath, 'utf-8');
    const config = yaml.parse(content);

    if (!config.providers || !Array.isArray(config.providers)) {
      throw new Error('Invalid providers configuration: providers array missing');
    }

    logger.info(`Loaded ${config.providers.length} provider definitions from ${configPath}`);
    this.providersConfig = config.providers;
    return config.providers;
  }

  /**
   * Load RBAC configuration
   */
  loadRbacConfig() {
    const configPath = path.join(this.configDir, 'rbac.yaml');
    if (!fs.existsSync(configPath)) {
      throw new Error(`RBAC configuration not found: ${configPath}`);
    }

    const content = fs.readFileSync(configPath, 'utf-8');
    const config = yaml.parse(content);

    if (!config.roles) {
      throw new Error('Invalid RBAC configuration: roles section missing');
    }

    if (!config.permissions) {
      throw new Error('Invalid RBAC configuration: permissions section missing');
    }

    logger.info(`Loaded RBAC configuration with ${Object.keys(config.roles).length} roles and ${config.permissions.length} permissions`);
    this.rbacConfig = config;
    return config;
  }

  /**
   * Get environment variable with optional default
   */
  getEnv(key, defaultValue = undefined) {
    const value = process.env[key];
    if (value !== undefined) return value;
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Environment variable ${key} not set`);
  }

  /**
   * Get environment variable or return default safely
   */
  getEnvSafe(key, defaultValue = null) {
    return process.env[key] || defaultValue;
  }

  /**
   * Load all configurations
   */
  loadAll() {
    const agents = this.loadAgentsConfig();
    const providers = this.loadProvidersConfig();
    const rbac = this.loadRbacConfig();

    return {
      agents,
      providers,
      rbac,
      env: {
        NODE_ENV: this.getEnvSafe('NODE_ENV', 'development'),
        PORT: this.getEnvSafe('PORT', '3000'),
        LOG_LEVEL: this.getEnvSafe('LOG_LEVEL', 'info'),
        DATABASE_URL: this.getEnvSafe('DATABASE_URL'),
        JWT_SECRET: this.getEnvSafe('JWT_SECRET', 'development-secret-change-in-production'),
        JWT_REFRESH_SECRET: this.getEnvSafe('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
        SESSION_SECRET: this.getEnvSafe('SESSION_SECRET', 'dev-session-secret'),
        ACCESS_TOKEN_EXPIRY_SECONDS: this.getEnvSafe('ACCESS_TOKEN_EXPIRY_SECONDS', '900'),
        REFRESH_TOKEN_EXPIRY_SECONDS: this.getEnvSafe('REFRESH_TOKEN_EXPIRY_SECONDS', '604800'),
        SESSION_MAX_AGE_MS: this.getEnvSafe('SESSION_MAX_AGE_MS', '86400000'),
        FORCE_HTTPS: this.getEnvSafe('FORCE_HTTPS', 'false') === 'true',
        ALLOW_DEVELOPMENT_BYPASSES: this.getEnvSafe('ALLOW_DEVELOPMENT_BYPASSES', 'true') === 'true',
        RATE_LIMIT_ENABLED: this.getEnvSafe('RATE_LIMIT_ENABLED', 'true') === 'true',
        FEATURE_IRISKEY_ENABLED: this.getEnvSafe('FEATURE_IRISKEY_ENABLED', 'true') === 'true',
        FEATURE_OIDC_ENABLED: this.getEnvSafe('FEATURE_OIDC_ENABLED', 'false') === 'true',
        IRISKEY_REAL_CONNECTION: this.getEnvSafe('IRISKEY_REAL_CONNECTION', 'false') === 'true',
        VOICEBOX_API_URL: this.getEnvSafe('VOICEBOX_API_URL'),
        COMFYUI_API_URL: this.getEnvSafe('COMFYUI_API_URL'),
        IRISKEY_API_URL: this.getEnvSafe('IRISKEY_API_URL'),
        LAO_API_URL: this.getEnvSafe('LAO_API_URL')
      }
    };
  }
}

module.exports = ConfigLoader;
