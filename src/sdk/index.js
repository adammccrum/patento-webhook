/**
 * Agent SDK - Main Entry Point
 *
 * Exports the Agent SDK and supporting utilities for agents to depend on
 * Core v1.0 APIs through a consistent, typed interface.
 */

const AgentSDK = require('./agent-sdk');
const {
  SDKError,
  withRetry,
  withTimeout,
  withErrorAudit,
  withIdempotency,
  IdempotencyCache,
  globalIdempotencyCache,
  composeDecorators
} = require('./decorators');

module.exports = {
  // Main SDK class
  AgentSDK,

  // Decorators (for advanced use)
  withRetry,
  withTimeout,
  withErrorAudit,
  withIdempotency,
  composeDecorators,

  // Error class
  SDKError,

  // Idempotency support
  IdempotencyCache,
  globalIdempotencyCache
};
