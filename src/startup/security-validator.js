/**
 * Security Validator - Validates production security configuration on startup
 * Ensures all security requirements are met before the application starts
 */

const logger = require('../utils/logger');
const fs = require('fs');

/**
 * Validate production security setup
 * Throws error if any critical checks fail
 */
function validateProductionSetup() {
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Only perform strict checks in production
  if (nodeEnv !== 'production') {
    logger.info('Security validation skipped (not in production environment)');
    return true;
  }

  logger.info('═══════════════════════════════════════════════════════════════');
  logger.info('PRODUCTION SECURITY VALIDATION');
  logger.info('═══════════════════════════════════════════════════════════════');

  const checks = {
    JWT_SECRET: checkJWTSecret,
    JWT_REFRESH_SECRET: checkJWTRefreshSecret,
    SESSION_SECRET: checkSessionSecret,
    DATABASE_URL: checkDatabaseUrl,
    HTTPS_ENABLED: checkHttpsEnabled,
    DEVELOPMENT_BYPASSES: checkDevelopmentBypasses,
    LOG_LEVEL: checkLogLevel
  };

  let failedChecks = 0;
  const results = {};

  for (const [checkName, checkFn] of Object.entries(checks)) {
    try {
      const result = checkFn();
      results[checkName] = result;

      if (result.passed) {
        logger.info(`✓ ${checkName}: ${result.message}`);
      } else {
        logger.error(`✗ ${checkName}: ${result.message}`);
        failedChecks++;
      }
    } catch (error) {
      logger.error(`✗ ${checkName}: ${error.message}`);
      failedChecks++;
    }
  }

  logger.info('═══════════════════════════════════════════════════════════════');

  if (failedChecks > 0) {
    const errorMessage = `Production security validation failed: ${failedChecks} check(s) failed`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  logger.info('✓ All security checks passed. Safe to start in production.');
  return true;
}

/**
 * Check JWT_SECRET is set and strong
 */
function checkJWTSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    return {
      passed: false,
      message: 'JWT_SECRET not set'
    };
  }

  if (secret === 'development-secret-change-in-production') {
    return {
      passed: false,
      message: 'JWT_SECRET is default development value'
    };
  }

  if (secret.length < 32) {
    return {
      passed: false,
      message: `JWT_SECRET too short (${secret.length} chars, need ≥32)`
    };
  }

  return {
    passed: true,
    message: `Set to ${secret.substring(0, 4)}...${secret.substring(-4)}`
  };
}

/**
 * Check JWT_REFRESH_SECRET is set and strong
 */
function checkJWTRefreshSecret() {
  const secret = process.env.JWT_REFRESH_SECRET;

  if (!secret) {
    return {
      passed: false,
      message: 'JWT_REFRESH_SECRET not set'
    };
  }

  if (secret === 'dev-refresh-secret') {
    return {
      passed: false,
      message: 'JWT_REFRESH_SECRET is default development value'
    };
  }

  if (secret.length < 32) {
    return {
      passed: false,
      message: `JWT_REFRESH_SECRET too short (${secret.length} chars, need ≥32)`
    };
  }

  return {
    passed: true,
    message: `Set to ${secret.substring(0, 4)}...${secret.substring(-4)}`
  };
}

/**
 * Check SESSION_SECRET is set and strong
 */
function checkSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    return {
      passed: false,
      message: 'SESSION_SECRET not set'
    };
  }

  if (secret === 'dev-session-secret') {
    return {
      passed: false,
      message: 'SESSION_SECRET is default development value'
    };
  }

  if (secret.length < 32) {
    return {
      passed: false,
      message: `SESSION_SECRET too short (${secret.length} chars, need ≥32)`
    };
  }

  return {
    passed: true,
    message: `Set to ${secret.substring(0, 4)}...${secret.substring(-4)}`
  };
}

/**
 * Check DATABASE_URL uses PostgreSQL (not SQLite)
 */
function checkDatabaseUrl() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    return {
      passed: false,
      message: 'DATABASE_URL not set'
    };
  }

  if (dbUrl.startsWith('sqlite:') || dbUrl.includes('.db')) {
    return {
      passed: false,
      message: 'DATABASE_URL uses SQLite (not suitable for production)'
    };
  }

  if (!dbUrl.startsWith('postgresql://')) {
    return {
      passed: false,
      message: 'DATABASE_URL does not use PostgreSQL'
    };
  }

  return {
    passed: true,
    message: 'Using PostgreSQL'
  };
}

/**
 * Check HTTPS is enabled
 */
function checkHttpsEnabled() {
  const forceHttps = process.env.FORCE_HTTPS === 'true';

  if (!forceHttps) {
    return {
      passed: false,
      message: 'FORCE_HTTPS not enabled'
    };
  }

  return {
    passed: true,
    message: 'HTTPS enforced'
  };
}

/**
 * Check development bypasses are disabled
 */
function checkDevelopmentBypasses() {
  const allowBypasses = process.env.ALLOW_DEVELOPMENT_BYPASSES === 'true';

  if (allowBypasses) {
    return {
      passed: false,
      message: 'ALLOW_DEVELOPMENT_BYPASSES is enabled in production'
    };
  }

  return {
    passed: true,
    message: 'Development bypasses disabled'
  };
}

/**
 * Check log level is not DEBUG
 */
function checkLogLevel() {
  const logLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();

  if (logLevel === 'debug') {
    return {
      passed: false,
      message: 'LOG_LEVEL is DEBUG (may leak sensitive information)'
    };
  }

  return {
    passed: true,
    message: `LOG_LEVEL set to ${logLevel}`
  };
}

module.exports = {
  validateProductionSetup
};
