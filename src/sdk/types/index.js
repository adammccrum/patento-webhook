/**
 * Agent SDK Type Definitions
 *
 * JSDoc type definitions for the Agent SDK and Core v1.0 interfaces.
 * These document expected parameter and return types for all SDK methods.
 */

/**
 * @typedef {Object} Task
 * @property {string} id - Task UUID
 * @property {string} objective_id - Parent objective UUID
 * @property {string} agent_code - 2-letter agent code
 * @property {string} status - pending|processing|completed|failed|cancelled
 * @property {string} capability_required - Capability name
 * @property {number} max_retries - Max retry attempts
 * @property {Array<string>} dependencies - Array of task IDs
 * @property {Object} input - Input data
 */

/**
 * @typedef {Object} TaskResult
 * @property {string} status - Task execution status
 * @property {*} output - Task output data
 * @property {string} [error] - Error message if failed
 * @property {number} retry_count - Number of retries attempted
 */

/**
 * @typedef {Object} Provider
 * @property {string} provider_id - Provider identifier
 * @property {string} name - Human-readable name
 * @property {string} category - Category (e.g., 'voice')
 * @property {boolean} enabled - Is provider enabled
 * @property {string} [configured] - Configuration status
 * @property {string} health_status - Current health status
 */

/**
 * @typedef {Object} Agent
 * @property {string} code - 2-letter agent code
 * @property {string} name - Agent name
 * @property {string} role - Agent role/type
 * @property {string} status - Agent status
 */

/**
 * @typedef {Object} AgentStatus
 * @property {string} status - Status code
 * @property {Date} last_heartbeat - Last activity timestamp
 * @property {number} active_tasks - Current task count
 */

/**
 * @typedef {Object} AuditEvent
 * @property {string} id - Event UUID
 * @property {number} sequence - Monotonic sequence number
 * @property {Date} timestamp - Event timestamp
 * @property {string} actor_id - User or service ID
 * @property {string} actor_type - 'user'|'service'|'system'
 * @property {string} action - Action identifier (e.g., 'objective:create')
 * @property {string} resource_type - Resource type
 * @property {string} resource_id - Resource UUID
 * @property {string} status - 'success'|'failure'
 * @property {string} details - JSON details
 * @property {string} event_hash - SHA256 hash of event
 */

/**
 * @typedef {Object} HealthStatus
 * @property {string} status - 'healthy'|'degraded'|'unhealthy'
 * @property {Object<string, Object>} components - Component health details
 */

/**
 * @typedef {Object} PermissionContext
 * @property {string} user_id - User identifier
 * @property {Array<string>} permissions - User's permissions
 * @property {Array<string>} roles - User's roles
 */

/**
 * @typedef {Object} RetryOptions
 * @property {number} maxAttempts - Maximum retry attempts
 * @property {number} initialDelayMs - Initial retry delay
 * @property {number} maxDelayMs - Maximum retry delay
 * @property {number} backoffMultiplier - Exponential backoff multiplier
 * @property {number} jitterFactor - Jitter percentage (0-1)
 */

/**
 * @typedef {Object} TimeoutOptions
 * @property {number} operationTimeoutMs - Operation timeout
 * @property {number} globalTimeoutMs - Global timeout
 */

/**
 * @typedef {Object} IdempotencyOptions
 * @property {string} key - Idempotency key
 * @property {number} ttlMs - Key TTL in milliseconds
 */

/**
 * @typedef {Object} SDKErrorAuditEvent
 * @property {string} agent_code - Agent that caused error
 * @property {string} operation - Operation name
 * @property {string} correlation_id - Correlation ID
 * @property {string} failure_class - Error class name
 * @property {string} message - Error message
 * @property {string} [stack] - Stack trace (admin only)
 */

/**
 * @typedef {Object} SDKErrorOptions
 * @property {string} agent_code - Agent code
 * @property {string} operation - Operation name
 * @property {string} correlation_id - Correlation ID
 * @property {string} [idempotencyKey] - Idempotency key
 */

/**
 * Agent SDK initialization parameters
 * @typedef {Object} AgentSDKOptions
 * @property {string} agentCode - 2-letter agent code
 * @property {Object} services - Core services
 * @property {TaskExecutionAPI} services.taskExecutor - Task execution service
 * @property {AuthorizationAPI} services.authorizer - Authorization service
 * @property {ProviderRegistryAPI} services.providerRegistry - Provider registry
 * @property {AgentRegistryAPI} services.agentRegistry - Agent registry
 * @property {AuditSystemAPI} services.auditLogger - Audit logging service
 * @property {EventStreamAPI} services.eventStream - Event streaming service
 * @property {RBACEngineAPI} services.rbacEngine - RBAC service
 * @property {AuthenticationServiceAPI} services.authenticator - Authentication service
 * @property {HealthMonitoringAPI} services.healthMonitor - Health monitoring
 * @property {Object} [options] - SDK options
 * @property {RetryOptions} [options.retry] - Retry configuration
 * @property {TimeoutOptions} [options.timeout] - Timeout configuration
 * @property {string} [options.correlationId] - Correlation ID
 * @property {PermissionContext} [options.permissionContext] - Permission context
 */

module.exports = {};
