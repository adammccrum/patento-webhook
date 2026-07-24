/**
 * Event Stream - WebSocket manager for real-time event delivery
 * Handles client connections, subscriptions, and event broadcasting
 */

const WebSocket = require('ws');
const { v4: uuid } = require('uuid');
const logger = require('../utils/logger');

class EventStream {
  constructor(httpServer, eventAggregator) {
    this.httpServer = httpServer;
    this.eventAggregator = eventAggregator;
    this.wss = null;
    this.clients = new Map(); // clientId -> { ws, filters, subscriptionId }
  }

  /**
   * Initialize WebSocket server
   */
  initialize() {
    this.wss = new WebSocket.Server({
      server: this.httpServer,
      path: '/ws/events'
    });

    this.wss.on('connection', (ws, req) => {
      this.handleClientConnection(ws, req);
    });

    logger.info('WebSocket server initialized at /ws/events');
    return this.wss;
  }

  /**
   * Handle new client connection
   */
  handleClientConnection(ws, req) {
    const clientId = uuid();
    const clientIP = req.socket.remoteAddress;

    logger.info(`Client connected: ${clientId} from ${clientIP}`);

    ws.on('message', (message) => {
      try {
        this.handleClientMessage(clientId, ws, JSON.parse(message));
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
      this.handleClientDisconnect(clientId);
    });

    ws.on('error', (error) => {
      logger.error(`WebSocket error for ${clientId}: ${error.message}`);
    });

    // Send welcome message
    this.sendToClient(ws, {
      type: 'connected',
      client_id: clientId,
      timestamp: new Date().toISOString()
    });

    this.clients.set(clientId, { ws, filters: {}, clientIP });
  }

  /**
   * Handle message from client
   */
  handleClientMessage(clientId, ws, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
    case 'subscribe':
      this.handleSubscribe(clientId, ws, message);
      break;

    case 'unsubscribe':
      this.handleUnsubscribe(clientId, ws, message);
      break;

    case 'get_recent_events':
      this.handleGetRecentEvents(clientId, ws, message);
      break;

    case 'get_state_snapshot':
      this.handleGetStateSnapshot(clientId, ws, message);
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
  }

  /**
   * Handle subscribe request
   */
  handleSubscribe(clientId, ws, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const filters = message.filters || {};
    client.filters = filters;

    // Subscribe to event aggregator
    if (client.subscriptionId) {
      this.eventAggregator.unsubscribe(client.subscriptionId);
    }

    const subscription = this.eventAggregator.subscribe(filters);
    client.subscriptionId = subscription.subscriberId;

    // Listen for events
    this.eventAggregator.on(`subscriber:${subscription.subscriberId}`, (event) => {
      this.sendToClient(ws, {
        type: 'event',
        data: event,
        timestamp: new Date().toISOString()
      });
    });

    // Send recent events for context
    const recentEvents = this.eventAggregator.getRecentEvents(20, filters);
    this.sendToClient(ws, {
      type: 'recent_events',
      data: recentEvents,
      timestamp: new Date().toISOString()
    });

    logger.debug(`Client ${clientId} subscribed with filters: ${JSON.stringify(filters)}`);
  }

  /**
   * Handle unsubscribe request
   */
  handleUnsubscribe(clientId, ws, _message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (client.subscriptionId) {
      this.eventAggregator.unsubscribe(client.subscriptionId);
      client.subscriptionId = null;
      client.filters = {};
    }

    this.sendToClient(ws, {
      type: 'unsubscribed',
      timestamp: new Date().toISOString()
    });

    logger.debug(`Client ${clientId} unsubscribed`);
  }

  /**
   * Handle recent events request
   */
  handleGetRecentEvents(clientId, ws, message) {
    const limit = message.limit || 50;
    const filters = message.filters || {};
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
   * Handle state snapshot request
   */
  handleGetStateSnapshot(clientId, ws, _message) {
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

    if (client.subscriptionId) {
      this.eventAggregator.unsubscribe(client.subscriptionId);
    }

    this.clients.delete(clientId);
    logger.info(`Client disconnected: ${clientId}`);
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
