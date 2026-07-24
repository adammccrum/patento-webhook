/**
 * Core v1.0 API - Frozen Interface Specification
 *
 * This module defines the protected Core v1.0 boundary. All modules in this
 * interface MUST maintain backwards compatibility. Future providers and agents
 * MUST use these interfaces rather than modifying core logic directly.
 *
 * CHANGE CONTROL: Core v1.0 changes require explicit deprecation cycle.
 * See /docs/CORE_CHANGE_POLICY.md for governance rules.
 */

const { v4: uuid } = require('uuid');

/**
 * Core v1.0 Public Interfaces
 * ============================
 * These are the ONLY interfaces future agents and providers should depend on.
 * Internal implementation may change, but public signatures remain stable.
 */

// Task Execution Interface
class TaskExecutionAPI {
  /**
   * @param {Object} task - Task to execute
   * @param {string} task.id - Task UUID
   * @param {string} task.objective_id - Parent objective UUID
   * @param {string} task.agent_code - 2-letter agent code
   * @param {string} task.status - pending|processing|completed|failed|cancelled
   * @param {string} task.capability_required - Capability name
   * @param {number} task.max_retries - Max retry attempts
   * @param {Array} task.dependencies - Array of task IDs (strict ordering)
   * @param {Object} task.input - Input data
   * @returns {Promise<{status, output, error?, retry_count}>}
   */
  async executeTask(task) {
    throw new Error('executeTask must be implemented by core');
  }

  /**
   * Get task status
   * @param {string} taskId
   * @returns {Promise<{status, output?, error?, retry_count}>}
   */
  async getTaskStatus(taskId) {
    throw new Error('getTaskStatus must be implemented by core');
  }

  /**
   * Cancel task
   * @param {string} taskId
   * @returns {Promise<void>}
   */
  async cancelTask(taskId) {
    throw new Error('cancelTask must be implemented by core');
  }

  /**
   * Retry task
   * @param {string} taskId
   * @returns {Promise<{status, output?, error?}>}
   */
  async retryTask(taskId) {
    throw new Error('retryTask must be implemented by core');
  }
}

// Authorization Interface
class AuthorizationAPI {
  /**
   * Check if user has permission
   * @param {string} userId
   * @param {string} action - e.g., 'objective:create'
   * @param {string} resourceType - e.g., 'objective'
   * @returns {Promise<boolean>}
   */
  async hasPermission(userId, action, resourceType) {
    throw new Error('hasPermission must be implemented by core');
  }

  /**
   * Get user roles
   * @param {string} userId
   * @returns {Promise<Array<string>>}
   */
  async getUserRoles(userId) {
    throw new Error('getUserRoles must be implemented by core');
  }

  /**
   * Get all user permissions (for caching)
   * @param {string} userId
   * @returns {Promise<Array<string>>}
   */
  async getUserPermissions(userId) {
    throw new Error('getUserPermissions must be implemented by core');
  }
}

// Provider Registry Interface
class ProviderRegistryAPI {
  /**
   * Get adapter for capability
   * @param {string} category - e.g., 'voice'
   * @param {string} capability - e.g., 'text-to-speech'
   * @returns {Promise<Object>} adapter instance
   */
  async getAdapterForCapability(category, capability) {
    throw new Error('getAdapterForCapability must be implemented by core');
  }

  /**
   * Get specific adapter
   * @param {string} providerId
   * @returns {Promise<Object>} adapter instance
   */
  async getAdapter(providerId) {
    throw new Error('getAdapter must be implemented by core');
  }

  /**
   * List all providers
   * @returns {Promise<Array<{provider_id, name, category, enabled, health_status}>>}
   */
  async listProviders() {
    throw new Error('listProviders must be implemented by core');
  }

  /**
   * Get provider by ID
   * @param {string} providerId
   * @returns {Promise<{provider_id, name, category, enabled, configured, health_status}|null>}
   */
  async getProvider(providerId) {
    throw new Error('getProvider must be implemented by core');
  }
}

// Agent Registry Interface
class AgentRegistryAPI {
  /**
   * Get agent by code
   * @param {string} agentCode - 2-letter code (e.g., 'AA', 'EE')
   * @returns {Promise<Object>} agent instance
   */
  async getAgent(agentCode) {
    throw new Error('getAgent must be implemented by core');
  }

  /**
   * List all agents
   * @returns {Promise<Array<{code, name, role, status}>>}
   */
  async listAgents() {
    throw new Error('listAgents must be implemented by core');
  }

  /**
   * Get agent status
   * @param {string} agentCode
   * @returns {Promise<{status, last_heartbeat, active_tasks}|null>}
   */
  async getAgentStatus(agentCode) {
    throw new Error('getAgentStatus must be implemented by core');
  }
}

// Audit System Interface
class AuditSystemAPI {
  /**
   * Log audit event (immutable, tamper-evident)
   * @param {Object} event
   * @param {string} event.actor_id - User or service ID
   * @param {string} event.actor_type - 'user'|'service'|'system'
   * @param {string} event.action - e.g., 'objective:create'
   * @param {string} event.resource_type - e.g., 'objective'
   * @param {string} event.resource_id - Resource UUID
   * @param {string} event.status - 'success'|'failure'
   * @param {string} event.details - JSON details
   * @returns {Promise<{id, sequence, timestamp, event_hash}>}
   */
  async logEvent(event) {
    throw new Error('logEvent must be implemented by core');
  }

  /**
   * Verify audit chain integrity
   * @param {number} startSequence
   * @param {number} endSequence
   * @returns {Promise<{valid, first_invalid_sequence?, tampering_detected}>}
   */
  async verifyChain(startSequence, endSequence) {
    throw new Error('verifyChain must be implemented by core');
  }

  /**
   * Query audit events (read-only)
   * @param {Object} filters - {actor_id?, action?, resource_type?, resource_id?, status?}
   * @param {number} limit
   * @returns {Promise<Array<{id, sequence, timestamp, event_hash, ...}>}
   */
  async queryEvents(filters, limit = 100) {
    throw new Error('queryEvents must be implemented by core');
  }
}

// Event Stream Interface
class EventStreamAPI {
  /**
   * Subscribe to events
   * @param {string} eventType - e.g., 'objective:created'
   * @param {Function} callback - (event) => void
   * @returns {string} subscription ID
   */
  subscribe(eventType, callback) {
    throw new Error('subscribe must be implemented by core');
  }

  /**
   * Unsubscribe from events
   * @param {string} subscriptionId
   * @returns {void}
   */
  unsubscribe(subscriptionId) {
    throw new Error('unsubscribe must be implemented by core');
  }

  /**
   * Emit event (core internal use)
   * @param {string} eventType
   * @param {Object} data
   * @returns {Promise<void>}
   */
  async emit(eventType, data) {
    throw new Error('emit must be implemented by core');
  }
}

// RBAC Engine Interface
class RBACEngineAPI {
  /**
   * Check if user has permission
   * @param {string} userId
   * @param {string} action
   * @returns {Promise<boolean>}
   */
  async hasPermission(userId, action) {
    throw new Error('hasPermission must be implemented by core');
  }

  /**
   * Get all user permissions
   * @param {string} userId
   * @returns {Promise<Array<string>>}
   */
  async getPermissions(userId) {
    throw new Error('getPermissions must be implemented by core');
  }

  /**
   * Enforce permission (throw if denied)
   * @param {string} userId
   * @param {string} action
   * @returns {Promise<void>}
   */
  async enforce(userId, action) {
    throw new Error('enforce must be implemented by core');
  }
}

// Authentication Service Interface
class AuthenticationServiceAPI {
  /**
   * Verify JWT token
   * @param {string} token
   * @returns {Promise<{user_id, email, roles, iat, exp}>}
   */
  async verifyToken(token) {
    throw new Error('verifyToken must be implemented by core');
  }

  /**
   * Refresh access token
   * @param {string} refreshToken
   * @returns {Promise<{access_token, refresh_token, expires_in}>}
   */
  async refreshToken(refreshToken) {
    throw new Error('refreshToken must be implemented by core');
  }

  /**
   * Get current user from request
   * @param {Object} req - Express request
   * @returns {Promise<{user_id, email, roles}|null>}
   */
  async getCurrentUser(req) {
    throw new Error('getCurrentUser must be implemented by core');
  }
}

// Health Monitoring Interface
class HealthMonitoringAPI {
  /**
   * Get system health
   * @returns {Promise<{status: 'healthy'|'degraded'|'unhealthy', components: {...}}>}
   */
  async getSystemHealth() {
    throw new Error('getSystemHealth must be implemented by core');
  }

  /**
   * Get component health
   * @param {string} component - e.g., 'database', 'event-stream', 'provider:voice'
   * @returns {Promise<{status, details?, last_checked}>}
   */
  async getComponentHealth(component) {
    throw new Error('getComponentHealth must be implemented by core');
  }

  /**
   * Register health check
   * @param {string} name - Component name
   * @param {Function} checkFn - async () => {status, details}
   * @returns {void}
   */
  registerHealthCheck(name, checkFn) {
    throw new Error('registerHealthCheck must be implemented by core');
  }
}

/**
 * Core v1.0 Versioning Contract
 * =============================
 */
const CORE_V1_SCHEMA_VERSIONS = {
  tasks: '1.0',
  objectives: '1.0',
  audit_events: '1.0',
  authorizations: '1.0',
  voice_jobs: '1.0'
};

/**
 * Core v1.0 Extension Points (for future agents/providers)
 * =========================================================
 *
 * Agents and providers MAY extend behavior via these points:
 * - Custom task validators (before execution)
 * - Custom event types (extending event-stream)
 * - Custom health checks (extending health monitoring)
 * - Custom RBAC rules (extending authorization)
 * - Custom provider adapters (extending provider registry)
 *
 * Agents and providers MUST NOT:
 * - Modify task execution logic directly
 * - Bypass RBAC checks
 * - Directly access database
 * - Disable audit logging
 * - Short-circuit event stream
 */

class CoreV1ExtensionPoint {
  static registerTaskValidator(agentCode, validatorFn) {
    // (Implemented by core)
    throw new Error('registerTaskValidator must be implemented by core');
  }

  static registerEventType(eventType, schema) {
    // (Implemented by core)
    throw new Error('registerEventType must be implemented by core');
  }

  static registerHealthCheck(componentName, checkFn) {
    // (Implemented by core)
    throw new Error('registerHealthCheck must be implemented by core');
  }

  static registerRBACRule(resourceType, ruleFn) {
    // (Implemented by core)
    throw new Error('registerRBACRule must be implemented by core');
  }

  static registerProviderAdapter(providerId, adapter) {
    // (Implemented by core)
    throw new Error('registerProviderAdapter must be implemented by core');
  }
}

/**
 * Core v1.0 Contract Enforcement
 * ==============================
 * All implementations of these interfaces MUST:
 * - Never silently fail
 * - Always log errors via audit system
 * - Always return consistent schemas
 * - Always respect timeouts
 * - Always maintain idempotency keys where required
 * - Always preserve causality (parent/child relationships)
 * - Never corrupt audit chain
 */

module.exports = {
  // Public interfaces (contract)
  TaskExecutionAPI,
  AuthorizationAPI,
  ProviderRegistryAPI,
  AgentRegistryAPI,
  AuditSystemAPI,
  EventStreamAPI,
  RBACEngineAPI,
  AuthenticationServiceAPI,
  HealthMonitoringAPI,

  // Extension points
  CoreV1ExtensionPoint,

  // Versioning
  CORE_V1_SCHEMA_VERSIONS,

  // Marker for compatibility checking
  CORE_V1_COMPATIBLE: true,
  CORE_VERSION: '1.0.0'
};
