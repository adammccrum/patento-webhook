/**
 * Agent SDK - Thin Wrapper Around Core v1.0
 *
 * Provides typed, decorated access to Core v1.0 APIs without duplicating
 * or bypassing core functionality. Maintains full backwards compatibility
 * with Phase 5A and enables future agents to use standardized patterns.
 *
 * This SDK is NOT a service implementation. It wraps existing services and
 * adds cross-cutting concerns (retry, timeout, audit, idempotency).
 */

const { v4: uuid } = require('uuid');
const {
  withRetry,
  withTimeout,
  withErrorAudit,
  composeDecorators,
  SDKError,
  globalIdempotencyCache
} = require('./decorators');

class AgentSDK {
  /**
   * Create SDK instance for a specific agent
   * @param {string} agentCode - 2-letter agent code
   * @param {Object} services - Core services
   * @param {Object} [options] - SDK configuration
   * @throws {SDKError} if services incomplete or agent not found
   */
  constructor(agentCode, services, options = {}) {
    this.agentCode = agentCode;
    this.correlationId = options.correlationId || uuid();
    this.permissionContext = options.permissionContext || null;

    // Validate all required services present
    const requiredServices = [
      'taskExecutor',
      'authorizer',
      'providerRegistry',
      'agentRegistry',
      'auditLogger',
      'eventStream',
      'rbacEngine',
      'authenticator',
      'healthMonitor'
    ];

    for (const serviceName of requiredServices) {
      if (!services[serviceName]) {
        throw new SDKError(`Missing required service: ${serviceName}`, {
          agentCode,
          operation: 'sdk:initialize'
        });
      }
    }

    // Store service references
    this._taskExecutor = services.taskExecutor;
    this._authorizer = services.authorizer;
    this._providerRegistry = services.providerRegistry;
    this._agentRegistry = services.agentRegistry;
    this._auditLogger = services.auditLogger;
    this._eventStream = services.eventStream;
    this._rbacEngine = services.rbacEngine;
    this._authenticator = services.authenticator;
    this._healthMonitor = services.healthMonitor;

    // Configuration
    this._retryOptions = options.retry || {
      maxAttempts: 3,
      initialDelayMs: 100,
      maxDelayMs: 5000,
      backoffMultiplier: 2,
      jitterFactor: 0.1
    };

    this._timeoutOptions = options.timeout || {
      operationTimeoutMs: 30000,
      globalTimeoutMs: 60000
    };

    this._idempotencyCache = options.idempotencyCache || globalIdempotencyCache;
  }

  /**
   * Factory: Create SDK for agent with dependency validation
   * @param {string} agentCode - 2-letter agent code
   * @param {Object} services - Core services
   * @param {Object} [options] - Configuration
   * @returns {AgentSDK} configured SDK instance
   */
  static createForAgent(agentCode, services, options = {}) {
    return new AgentSDK(agentCode, services, options);
  }

  /**
   * Get Task Executor with decorators
   * @returns {Object} decorated task executor
   */
  getTaskExecutor() {
    const executor = {
      executeTask: this._decorateMethod(
        this._taskExecutor.executeTask.bind(this._taskExecutor),
        'executeTask',
        { isRetryable: true }
      ),
      getTaskStatus: this._decorateMethod(
        this._taskExecutor.getTaskStatus.bind(this._taskExecutor),
        'getTaskStatus',
        { isRetryable: true }
      ),
      cancelTask: this._decorateMethod(
        this._taskExecutor.cancelTask.bind(this._taskExecutor),
        'cancelTask',
        { isRetryable: false }
      ),
      retryTask: this._decorateMethod(
        this._taskExecutor.retryTask.bind(this._taskExecutor),
        'retryTask',
        { isRetryable: true }
      )
    };
    return executor;
  }

  /**
   * Get Authorizer with decorators
   * @returns {Object} decorated authorizer
   */
  getAuthorizer() {
    return {
      hasPermission: this._decorateMethod(
        this._authorizer.hasPermission.bind(this._authorizer),
        'hasPermission',
        { isRetryable: true }
      ),
      getUserRoles: this._decorateMethod(
        this._authorizer.getUserRoles.bind(this._authorizer),
        'getUserRoles',
        { isRetryable: true }
      ),
      getUserPermissions: this._decorateMethod(
        this._authorizer.getUserPermissions.bind(this._authorizer),
        'getUserPermissions',
        { isRetryable: true }
      )
    };
  }

  /**
   * Get Provider Registry with decorators
   * @returns {Object} decorated provider registry
   */
  getProviderRegistry() {
    return {
      getAdapterForCapability: this._decorateMethod(
        this._providerRegistry.getAdapterForCapability.bind(this._providerRegistry),
        'getAdapterForCapability',
        { isRetryable: true }
      ),
      getAdapter: this._decorateMethod(
        this._providerRegistry.getAdapter.bind(this._providerRegistry),
        'getAdapter',
        { isRetryable: true }
      ),
      listProviders: this._decorateMethod(
        this._providerRegistry.listProviders.bind(this._providerRegistry),
        'listProviders',
        { isRetryable: true }
      ),
      getProvider: this._decorateMethod(
        this._providerRegistry.getProvider.bind(this._providerRegistry),
        'getProvider',
        { isRetryable: true }
      )
    };
  }

  /**
   * Get Agent Registry with decorators
   * @returns {Object} decorated agent registry
   */
  getAgentRegistry() {
    return {
      getAgent: this._decorateMethod(
        this._agentRegistry.getAgent.bind(this._agentRegistry),
        'getAgent',
        { isRetryable: true }
      ),
      listAgents: this._decorateMethod(
        this._agentRegistry.listAgents.bind(this._agentRegistry),
        'listAgents',
        { isRetryable: true }
      ),
      getAgentStatus: this._decorateMethod(
        this._agentRegistry.getAgentStatus.bind(this._agentRegistry),
        'getAgentStatus',
        { isRetryable: true }
      )
    };
  }

  /**
   * Get Audit Logger with decorators
   * @returns {Object} decorated audit logger
   */
  getAuditLogger() {
    return {
      logEvent: this._decorateMethod(
        this._auditLogger.logEvent.bind(this._auditLogger),
        'logEvent',
        { isRetryable: true }
      ),
      verifyChain: this._decorateMethod(
        this._auditLogger.verifyChain.bind(this._auditLogger),
        'verifyChain',
        { isRetryable: true }
      ),
      queryEvents: this._decorateMethod(
        this._auditLogger.queryEvents.bind(this._auditLogger),
        'queryEvents',
        { isRetryable: true }
      )
    };
  }

  /**
   * Get Event Stream with decorators
   * @returns {Object} decorated event stream
   */
  getEventStream() {
    return {
      subscribe: this._eventStream.subscribe.bind(this._eventStream),
      unsubscribe: this._eventStream.unsubscribe.bind(this._eventStream),
      emit: this._decorateMethod(
        this._eventStream.emit.bind(this._eventStream),
        'emit',
        { isRetryable: true }
      )
    };
  }

  /**
   * Get RBAC Engine with decorators
   * @returns {Object} decorated RBAC engine
   */
  getRBACEngine() {
    return {
      hasPermission: this._decorateMethod(
        this._rbacEngine.hasPermission.bind(this._rbacEngine),
        'hasPermission',
        { isRetryable: true }
      ),
      getPermissions: this._decorateMethod(
        this._rbacEngine.getPermissions.bind(this._rbacEngine),
        'getPermissions',
        { isRetryable: true }
      ),
      enforce: this._decorateMethodAuth(
        this._rbacEngine.enforce.bind(this._rbacEngine),
        'enforce'
      )
    };
  }

  /**
   * Get Authentication Service with decorators
   * @returns {Object} decorated authenticator
   */
  getAuthenticator() {
    return {
      verifyToken: this._decorateMethodAuth(
        this._authenticator.verifyToken.bind(this._authenticator),
        'verifyToken'
      ),
      refreshToken: this._decorateMethodAuth(
        this._authenticator.refreshToken.bind(this._authenticator),
        'refreshToken'
      ),
      getCurrentUser: this._decorateMethod(
        this._authenticator.getCurrentUser.bind(this._authenticator),
        'getCurrentUser',
        { isRetryable: true }
      )
    };
  }

  /**
   * Get Health Monitor with decorators
   * @returns {Object} decorated health monitor
   */
  getHealthMonitor() {
    return {
      getSystemHealth: this._decorateMethod(
        this._healthMonitor.getSystemHealth.bind(this._healthMonitor),
        'getSystemHealth',
        { isRetryable: true }
      ),
      getComponentHealth: this._decorateMethod(
        this._healthMonitor.getComponentHealth.bind(this._healthMonitor),
        'getComponentHealth',
        { isRetryable: true }
      ),
      registerHealthCheck: this._healthMonitor.registerHealthCheck.bind(this._healthMonitor)
    };
  }

  /**
   * Decorate method with retry, timeout, error audit, idempotency
   * Authorization failures and permission denials are never retried
   * @private
   */
  _decorateMethod(fn, operationName, { isRetryable = true } = {}) {
    const decorators = [
      (f) => withErrorAudit(f, {
        auditLogger: this._auditLogger,
        agentCode: this.agentCode,
        operation: operationName,
        correlationId: this.correlationId
      }),
      (f) => withTimeout(f, {
        ...this._timeoutOptions,
        agentCode: this.agentCode,
        operation: operationName
      })
    ];

    if (isRetryable) {
      decorators.push((f) => withRetry(f, this._retryOptions));
    }

    return composeDecorators(fn, decorators);
  }

  /**
   * Decorate authorization-related method
   * Never retries auth/permission failures
   * @private
   */
  _decorateMethodAuth(fn, operationName) {
    const decorators = [
      (f) => withErrorAudit(f, {
        auditLogger: this._auditLogger,
        agentCode: this.agentCode,
        operation: operationName,
        correlationId: this.correlationId
      }),
      (f) => withTimeout(f, {
        ...this._timeoutOptions,
        agentCode: this.agentCode,
        operation: operationName
      })
    ];

    // Authorization methods use special retry filter
    const retryFilter = (error) => {
      // Never retry authorization or permission errors
      if (error.isAuthorizationFailure || error.isPermissionDenial) {
        return false;
      }
      // Retry transient errors
      return error.isRetryable !== false;
    };

    decorators.push((f) => withRetry(f, {
      ...this._retryOptions,
      isRetryable: retryFilter
    }));

    return composeDecorators(fn, decorators);
  }

  /**
   * Get SDK identity and context
   * @returns {Object} identity information
   */
  getIdentity() {
    return {
      agentCode: this.agentCode,
      correlationId: this.correlationId,
      permissionContext: this.permissionContext
    };
  }

  /**
   * Shutdown SDK gracefully
   * Cleans up caches and stops background operations
   * @returns {Promise<void>}
   */
  async shutdown() {
    // Clear idempotency cache
    this._idempotencyCache.clear();

    try {
      // Log shutdown
      await this._auditLogger.logEvent({
        actor_id: this.agentCode,
        actor_type: 'service',
        action: 'sdk:shutdown',
        resource_type: 'sdk',
        resource_id: this.correlationId,
        status: 'success',
        details: JSON.stringify({
          agent_code: this.agentCode,
          message: 'SDK shutdown complete'
        })
      });
    } catch {
      // Shutdown errors are logged but don't throw
      // This ensures shutdown always completes
    }
  }
}

module.exports = AgentSDK;
