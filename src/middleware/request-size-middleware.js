/**
 * Request Size Limiting Middleware
 * Limits request body size and WebSocket message size
 */

const logger = require('../utils/logger');

const MAX_REQUEST_BODY_SIZE = process.env.MAX_REQUEST_BODY_SIZE || '1mb';
const MAX_WEBSOCKET_MESSAGE_SIZE = parseInt(process.env.MAX_WEBSOCKET_MESSAGE_SIZE || '65536'); // 64 KB

/**
 * Middleware to limit request body size
 * Express's built-in express.json and express.urlencoded handle this,
 * but this middleware provides additional logging and custom handling
 */
function requestSizeMiddleware(req, res, next) {
  // Content-Length check (quick pre-flight)
  const contentLength = req.headers['content-length'];
  if (contentLength) {
    const bytes = parseInt(contentLength);
    const maxBytes = parseMaxSize(MAX_REQUEST_BODY_SIZE);

    if (bytes > maxBytes) {
      logger.warn(`Request body too large for ${req.method} ${req.path}: ${bytes} bytes (limit: ${maxBytes})`);

      return res.status(413).json({
        error: 'Payload Too Large',
        code: 'PAYLOAD_TOO_LARGE',
        received: bytes,
        limit: maxBytes,
        timestamp: new Date().toISOString()
      });
    }
  }

  next();
}

/**
 * Validate WebSocket message size
 */
function validateWebSocketMessageSize(message) {
  let size = 0;

  if (typeof message === 'string') {
    size = Buffer.byteLength(message, 'utf8');
  } else if (Buffer.isBuffer(message)) {
    size = message.length;
  } else if (typeof message === 'object') {
    size = Buffer.byteLength(JSON.stringify(message), 'utf8');
  }

  if (size > MAX_WEBSOCKET_MESSAGE_SIZE) {
    logger.warn(`WebSocket message too large: ${size} bytes (limit: ${MAX_WEBSOCKET_MESSAGE_SIZE})`);
    return {
      valid: false,
      error: 'Message too large',
      size,
      limit: MAX_WEBSOCKET_MESSAGE_SIZE
    };
  }

  return { valid: true };
}

/**
 * Parse size string (e.g., "1mb", "100kb") to bytes
 */
function parseMaxSize(sizeString) {
  const units = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024
  };

  const match = sizeString.toLowerCase().match(/^(\d+)\s*([a-z]+)$/);
  if (!match) {
    return parseInt(sizeString) || 1 * 1024 * 1024; // Default to 1MB
  }

  const [, value, unit] = match;
  const multiplier = units[unit] || 1;
  return parseInt(value) * multiplier;
}

module.exports = {
  requestSizeMiddleware,
  validateWebSocketMessageSize,
  MAX_REQUEST_BODY_SIZE,
  MAX_WEBSOCKET_MESSAGE_SIZE
};
