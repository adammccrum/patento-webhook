/**
 * Event Stream - WebSocket manager for real-time event delivery
 * Handles client connections, subscriptions, and event broadcasting
 * Phase 4D: Authentication and RBAC enforcement
 */

const WebSocket = require('ws');
const { v4: uuid } = require('uuid');
const logger = require('../utils/logger');
const authService = require('../auth/auth-service');
const rbacEngine = require('../authorization/rbac-engine');
const securityLogger = require('../audit/security-logger');

class EventStream {
  constructor(httpServer, eventAggregator) {
    this.httpServer = httpServer;
    this.eventAggregator = eventAggregator;
    this.wss = null;
    this.clients = new Map(); // clientId -> { ws, filters, subscriptionId, user, clientIP, subscriptions, createdAt }
    this.heartbeatInterval = null;
    this.subscriptionLimits = {
      maxPerConnection: 5,
      maxReplayAge: 3600000 // 1 hour in ms
    };
  }

  /**
   * Initialize WebSocket server
   */
  initialize() {
    this.wss = new WebSocket.Server({
      server: this.httpServer,
      path: '/ws/events',
      verifyClient: (info, callback) => {
        this.verifyWebSocketClient(info, callback);
      }
    });

    this.wss.on('connection', (ws, req) => {
      this.handleClientConnection(ws, req);
    });

    // Start heartbeat to detect and clean up stale connections
    this.startHeartbeat();

    logger.info('WebSocket server initialized at /ws/events (authenticated, TLS/WSS required in production)');
    return this.wss;
  }

  /**
   * Start heartbeat interval for stale connection detection
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
          ws.terminate();
          return;
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 second interval
  }

  /**
   * Stop heartbeat on shutdown
   */
  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.wss) {
      this.wss.close();
    }
  }

  /**
   * Verify WebSocket client authentication
   * Called before connection is established
   */
  verifyWebSocketClient(info, callback) {
    const url = new URL(`http://localhost${info.req.url}`);
    const token = url.searchParams.get('token');
    const clientIP = info.req.socket.remoteAddress;
    const origin = info.origin || info.req.headers.origin;

    // Verify origin if required (prevent CSRF)
    if (!this.isOriginAllowed(origin)) {
      logger.warn(`WebSocket connection rejected: origin not allowed from ${clientIP}: ${origin}`);
      securityLogger.logWebSocketAuthFailure(clientIP, 'origin_not_allowed');
      callback(false, 403, 'Forbidden: origin not allowed');
      return;
    }

    if (!token) {
      logger.warn(`WebSocket connection rejected: no token from ${clientIP}`);
      securityLogger.logWebSocketAuthFailure(clientIP, 'missing_token');
      callback(false, 401, 'Unauthorized: token required');
      return;
    }

    try {
      const verification = authService.verifyJWT(token);
      if (!verification.valid) {
        logger.warn(`WebSocket connection rejected: invalid token from ${clientIP}`);
        securityLogger.logWebSocketAuthFailure(clientIP, 'invalid_token');
        callback(false, 401, 'Unauthorized: invalid token');
        return;
      }

      // Attach user info to request for later use
      info.req.user = {
        id: verification.payload.sub,
        email: verification.payload.email,
        type: verification.payload.type
      };

      // Check WebSocket permission
      rbacEngine.hasPermission(info.req.user.id, 'websocket:connect')
        .then(hasPermission => {
          if (!hasPermission) {
            logger.warn(`WebSocket connection rejected: no websocket:connect permission for ${info.req.user.email}`);
            securityLogger.logWebSocketAuthFailure(clientIP, `no_permission:${info.req.user.email}`);
            callback(false, 403, 'Forbidden: websocket:connect permission required');
            return;
          }

          logger.debug(`WebSocket client authenticated: ${info.req.user.email}`);
          securityLogger.logAuthSuccess(info.req.user.id, clientIP, 'websocket_connect');
          callback(true);
        })
        .catch(error => {
          logger.error(`WebSocket permission check error: ${error.message}`);
          securityLogger.logWebSocketAuthFailure(clientIP, `permission_check_error:${error.message}`);
          callback(false, 500, 'Internal error');
        });
    } catch (error) {
      logger.error(`WebSocket authentication error: ${error.message}`);
      securityLogger.logWebSocketAuthFailure(clientIP, `auth_error:${error.message}`);
      callback(false, 400, 'Bad request');
    }
  }

  /**
   * Validate origin header to prevent CSRF
   */
  isOriginAllowed(origin) {
    // Allow localhost and development
    if (!origin) return true;
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) return true;
    // In production, configure allowed origins via environment
    const allowedOrigins = (process.env.WEBSOCKET_ALLOWED_ORIGINS || '').split(',').filter(Boolean);
    if (allowedOrigins.length > 0) {
      return allowedOrigins.some(allowed => origin.includes(allowed.trim()));
    }
    // Default allow for development
    return true;
  }

  /**
   * Handle new client connection
   */
  handleClientConnection(ws, req) {
    const clientId = uuid();
    const clientIP = req.socket.remoteAddress;
    const user = req.user; // Set by verifyWebSocketClient

    if (!user) {
      logger.error('WebSocket connection accepted without user info');
      ws.close(1008, 'Unauthenticated');
      return;
    }

    logger.info(`WebSocket client authenticated: ${user.email} (${clientId}) from ${clientIP}`);

    ws.on('message', (message) => {
      try {
        // Validate message size (max 64KB) before parsing
        if (message.length > 65536) {
          logger.warn(`WebSocket message too large from ${clientId}: ${message.length} bytes`);
          this.sendToClient(ws, {
            type: 'error',
            error: 'Message too large (max 64KB)',
            timestamp: new Date().toISOString()
          });
          return;
        }

        const data = JSON.parse(message);
        this.handleClientMessage(clientId, ws, data, user);
      } catch (error) {
        logger.warn(`Invalid message from ${clientId}: ${error.message}`);
        this.sendToClient(ws, {
          type: 'error',
          error: 'Invalid message format',
          timestamp: new Date().toISOString()
        });
      }
    });

    ws.on('close', () => {
      this.handleClientDisconnect(clientId, user);
    });

    ws.on('error', (error) => {
      logger.error(`WebSocket error for ${clientId}: ${error.message}`);
    });

    // Setup heartbeat to detect stale connections
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Send welcome message
    this.sendToClient(ws, {
      type: 'connected',
      client_id: clientId,
      user: {
        id: user.id,
        email: user.email
      },
      timestamp: new Date().toISOString()
    });

    this.clients.set(clientId, {
      ws,
      filters: {},
      clientIP,
      user,
      subscriptions: new Set(),
      createdAt: new Date(),
      subscriptionCount: 0
    });
  }

  /**
   * Handle message from client
   */
  async handleClientMessage(clientId, ws, message, user) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      switch (message.type) {
      case 'subscribe':
        await this.handleSubscribe(clientId, ws, message, user);
        break;

      case 'unsubscribe':
        this.handleUnsubscribe(clientId, ws, message, user);
        break;

      case 'get_recent_events':
        await this.handleGetRecentEvents(clientId, ws, message, user);
        break;

      case 'get_state_snapshot':
        await this.handleGetStateSnapshot(clientId, ws, message, user);
        break;

      case 'ping':
        this.sendToClient(ws, {
          type: 'pong',
          timestamp: new Date().toISOString()
        });
        break;

      default:
        logger.warn(`Unknown message type from ${clientId}: ${message.type}`);
        this.sendToClient(ws, {
          type: 'error',
          error: `Unknown message type: ${message.type}`,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error(`Error handling message from ${clientId}: ${error.message}`);
      this.sendToClient(ws, {
        type: 'error',
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle subscribe request with permission checks
   */
  async handleSubscribe(clientId, ws, message, user) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const filters = message.filters || {};

    // Check subscription limit
    if (client.subscriptionCount >= this.subscriptionLimits.maxPerConnection) {
      logger.warn(`Client ${clientId} exceeded subscription limit`);
      this.sendToClient(ws, {
        type: 'error',
        error: `Too many subscriptions (max ${this.subscriptionLimits.maxPerConnection})`,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Enforce RBAC for different event types
    try {
      const requiredPermissions = this.getRequiredPermissionsForFilters(filters);
      for (const permission of requiredPermissions) {
        const hasPermission = await rbacEngine.hasPermission(user.id, permission);
        if (!hasPermission) {
          logger.warn(`Client ${clientId} lacks permission for subscription: ${permission}`);
          this.sendToClient(ws, {
            type: 'error',
            error: `Forbidden: ${permission} permission required`,
            timestamp: new Date().toISOString()
          });
          return;
        }
      }
    } catch (error) {
      logger.error(`Permission check error during subscription: ${error.message}`);
      this.sendToClient(ws, {
        type: 'error',
        error: 'Permission check failed',
        timestamp: new Date().toISOString()
      });
      return;
    }

    client.filters = filters;

    // Unsubscribe from previous subscription
    if (client.subscriptionId) {
      this.eventAggregator.unsubscribe(client.subscriptionId);
    }

    // Subscribe to event aggregator
    const subscription = this.eventAggregator.subscribe(filters);
    client.subscriptionId = subscription.subscriberId;
    client.subscriptionCount++;

    // Listen for events
    this.eventAggregator.on(`subscriber:${subscription.subscriberId}`, (event) => {
      this.sendToClient(ws, {
        type: 'event',
        data: event,
        timestamp: new Date().toISOString()
      });
    });

    // Send recent events for context (respect replay age limit)
    const recentEvents = this.eventAggregator.getRecentEvents(20, filters);
    const filteredEvents = recentEvents.filter(e => {
      if (!e.timestamp) return true;
      const age = Date.now() - new Date(e.timestamp).getTime();
      return age <= this.subscriptionLimits.maxReplayAge;
    });

    this.sendToClient(ws, {
      type: 'recent_events',
      data: filteredEvents,
      timestamp: new Date().toISOString()
    });

    logger.debug(`Client ${clientId} subscribed with filters: ${JSON.stringify(filters)}`);
  }

  /**
   * Get required permissions for event subscription filters
   */
  getRequiredPermissionsForFilters(filters) {
    const permissions = [];

    if (filters.agent) permissions.push('websocket:agent_view');
    if (filters.authorization) permissions.push('websocket:authorization_view');
    if (filters.audit) permissions.push('websocket:audit_view');
    if (filters.objective) permissions.push('websocket:objective_view');
    if (filters.task) permissions.push('websocket:task_view');

    // Default permission if no specific filters
    if (permissions.length === 0) {
      permissions.push('websocket:events_view');
    }

    return permissions;
  }

  /**
   * Handle unsubscribe request
   */
  handleUnsubscribe(clientId, ws, _message, user) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (client.subscriptionId) {
      this.eventAggregator.unsubscribe(client.subscriptionId);
      client.subscriptionId = null;
      client.filters = {};
      client.subscriptionCount = Math.max(0, client.subscriptionCount - 1);
    }

    this.sendToClient(ws, {
      type: 'unsubscribed',
      timestamp: new Date().toISOString()
    });

    logger.debug(`Client ${clientId} unsubscribed`);
  }

  /**
   * Handle recent events request with permission checks
   */
  async handleGetRecentEvents(clientId, ws, message, user) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const limit = Math.min(message.limit || 50, 200); // Cap at 200
    const filters = message.filters || {};

    // Enforce RBAC for event retrieval
    try {
      const requiredPermissions = this.getRequiredPermissionsForFilters(filters);
      for (const permission of requiredPermissions) {
        const hasPermission = await rbacEngine.hasPermission(user.id, permission);
        if (!hasPermission) {
          logger.warn(`Client ${clientId} lacks permission for recent events: ${permission}`);
          this.sendToClient(ws, {
            type: 'error',
            error: `Forbidden: ${permission} permission required`,
            timestamp: new Date().toISOString()
          });
          return;
        }
      }
    } catch (error) {
      logger.error(`Permission check error during get_recent_events: ${error.message}`);
      this.sendToClient(ws, {
        type: 'error',
        error: 'Permission check failed',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const recentEvents = this.eventAggregator.getRecentEvents(limit, filters);

    this.sendToClient(ws, {
      type: 'recent_events',
      data: recentEvents,
      limit,
      count: recentEvents.length,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle state snapshot request with permission checks
   */
  async handleGetStateSnapshot(clientId, ws, _message, user) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // State snapshot requires objective:view permission
    try {
      const hasPermission = await rbacEngine.hasPermission(user.id, 'websocket:state_view');
      if (!hasPermission) {
        logger.warn(`Client ${clientId} lacks permission for state snapshot`);
        this.sendToClient(ws, {
          type: 'error',
          error: 'Forbidden: websocket:state_view permission required',
          timestamp: new Date().toISOString()
        });
        return;
      }
    } catch (error) {
      logger.error(`Permission check error during get_state_snapshot: ${error.message}`);
      this.sendToClient(ws, {
        type: 'error',
        error: 'Permission check failed',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const snapshot = this.eventAggregator.getStateSnapshot();

    this.sendToClient(ws, {
      type: 'state_snapshot',
      data: snapshot,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send message to client
   */
  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcastEvent(event) {
    const message = {
      type: 'event',
      data: event,
      timestamp: new Date().toISOString()
    };

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  /**
   * Handle client disconnect
   */
  handleClientDisconnect(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Clean up subscriptions
    if (client.subscriptionId) {
      this.eventAggregator.unsubscribe(client.subscriptionId);
    }

    const connectionDuration = Date.now() - client.createdAt.getTime();
    this.clients.delete(clientId);

    logger.info(`Client disconnected: ${clientId} (${client.user.email}, duration: ${connectionDuration}ms, subscriptions: ${client.subscriptionCount})`);
  }

  /**
   * Get number of connected clients
   */
  getConnectedClientCount() {
    return this.clients.size;
  }

  /**
   * Get client info
   */
  getClientInfo(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return null;

    return {
      clientId,
      filters: client.filters,
      ip: client.clientIP,
      connected_at: new Date().toISOString()
    };
  }

  /**
   * Get all connected clients info
   */
  getAllClientsInfo() {
    return Array.from(this.clients.entries()).map(([clientId, client]) => ({
      clientId,
      filters: client.filters,
      ip: client.clientIP
    }));
  }
}

module.exports = EventStream;
