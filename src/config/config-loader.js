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

    return {
      agents,
      providers,
      env: {
        NODE_ENV: this.getEnvSafe('NODE_ENV', 'development'),
        PORT: this.getEnvSafe('PORT', '3000'),
        LOG_LEVEL: this.getEnvSafe('LOG_LEVEL', 'info'),
        VOICEBOX_API_URL: this.getEnvSafe('VOICEBOX_API_URL'),
        COMFYUI_API_URL: this.getEnvSafe('COMFYUI_API_URL'),
        IRISKEY_API_URL: this.getEnvSafe('IRISKEY_API_URL'),
        LAO_API_URL: this.getEnvSafe('LAO_API_URL')
      }
    };
  }
}

module.exports = ConfigLoader;
