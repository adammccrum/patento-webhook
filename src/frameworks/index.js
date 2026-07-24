/**
 * Framework Registry Module
 *
 * Exports all framework registry and adapter components.
 */

// Base classes and interfaces
const FrameworkBase = require('./framework-base');
const FrameworkAdapter = require('./framework-adapter');
const FrameworkContext = require('./framework-context');
const FrameworkResult = require('./framework-result');

// Core components
const FrameworkRegistry = require('./framework-registry');
const FrameworkPolicy = require('./framework-policy');
const FrameworkHealth = require('./framework-health');
const FrameworkManager = require('./framework-manager');

// Error classes
const {
  FrameworkError,
  FrameworkNotFoundError,
  FrameworkAdapterError,
  FrameworkNotAvailableError,
  FrameworkConfigError,
  FrameworkExecutionError,
  GuardianRequiredError,
  SierraRequiredError,
  UniformRequiredError,
  FrameworkVersionError,
  FrameworkIncompatibleError
} = require('./framework-errors');

module.exports = {
  // Base classes
  FrameworkBase,
  FrameworkAdapter,
  FrameworkContext,
  FrameworkResult,

  // Core components
  FrameworkRegistry,
  FrameworkPolicy,
  FrameworkHealth,
  FrameworkManager,

  // Errors
  FrameworkError,
  FrameworkNotFoundError,
  FrameworkAdapterError,
  FrameworkNotAvailableError,
  FrameworkConfigError,
  FrameworkExecutionError,
  GuardianRequiredError,
  SierraRequiredError,
  UniformRequiredError,
  FrameworkVersionError,
  FrameworkIncompatibleError
};
