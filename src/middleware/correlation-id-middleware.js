/**
 * Correlation ID Middleware
 * Generates or extracts correlation ID from headers
 * Attaches to requests and includes in responses
 */

const { v4: uuid } = require('uuid');
const logger = require('../utils/logger');

const CORRELATION_ID_HEADER = 'x-correlation-id';
const TRACE_ID_HEADER = 'x-trace-id';

/**
 * Correlation ID middleware
 * Generates or extracts correlation ID and traces
 */
function correlationIdMiddleware(req, res, next) {
  // Extract or generate correlation ID
  let correlationId = req.headers[CORRELATION_ID_HEADER];
  if (!correlationId) {
    correlationId = uuid();
  }

  // Extract or generate trace ID
  let traceId = req.headers[TRACE_ID_HEADER];
  if (!traceId) {
    traceId = uuid();
  }

  // Attach to request
  req.correlationId = correlationId;
  req.traceId = traceId;

  // Attach to response headers
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  res.setHeader(TRACE_ID_HEADER, traceId);

  // Log with correlation ID
  logger.debug(`[${correlationId}] ${req.method} ${req.path}`, {
    correlationId,
    traceId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  // Override response.json to include correlation ID
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    if (typeof data === 'object' && data !== null) {
      data.correlationId = correlationId;
    }
    return originalJson(data);
  };

  next();
}

/**
 * Get correlation context for logging
 */
function getCorrelationContext(req) {
  return {
    correlationId: req.correlationId,
    traceId: req.traceId,
    userId: req.user?.id,
    method: req.method,
    path: req.path
  };
}

module.exports = {
  correlationIdMiddleware,
  getCorrelationContext,
  CORRELATION_ID_HEADER,
  TRACE_ID_HEADER
};
