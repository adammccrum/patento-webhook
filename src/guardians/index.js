/**
 * Guardian Framework
 *
 * Modular security-control layer for agent and provider execution.
 * Main entry point for Guardian Framework components.
 */

const GuardianManager = require('./guardian-manager');
const GuardianRegistry = require('./guardian-registry');
const GuardianPolicy = require('./guardian-policy');
const GuardianPipeline = require('./guardian-pipeline');
const GuardianHealthMonitor = require('./guardian-health-monitor');
const GuardianBase = require('./guardian-base');
const GuardianContext = require('./guardian-context');
const GuardianResult = require('./guardian-result');

const {
  GuardianError,
  GuardianUnavailableError,
  GuardianTimeoutError,
  GuardianDeniedError,
  GuardianConfigError,
  GuardianPolicyViolationError,
  GuardianContextError,
  GuardianRegistryError,
  GuardianCancelledError
} = require('./guardian-errors');

const MockGuardian = require('./adapters/mock-guardian');

module.exports = {
  // Manager
  GuardianManager,

  // Core components
  GuardianRegistry,
  GuardianPolicy,
  GuardianPipeline,
  GuardianHealthMonitor,

  // Base and interfaces
  GuardianBase,
  GuardianContext,
  GuardianResult,

  // Errors
  GuardianError,
  GuardianUnavailableError,
  GuardianTimeoutError,
  GuardianDeniedError,
  GuardianConfigError,
  GuardianPolicyViolationError,
  GuardianContextError,
  GuardianRegistryError,
  GuardianCancelledError,

  // Adapters
  MockGuardian
};
