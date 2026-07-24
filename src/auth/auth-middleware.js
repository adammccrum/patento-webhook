/**
 * Authentication middleware
 * Verifies JWT tokens and attaches user context to requests
 */

const logger = require('../utils/logger');
const authService = require('./auth-service');

/**
 * Authentication middleware
 * Checks for JWT in Authorization header or cookies
 * Attaches req.user if valid
 */
function authMiddleware(req, res, next) {
  // Check if this is a public endpoint (login, health, status, etc.)
  const publicEndpoints = [
    '/health',
    '/status',
    '/api/auth/login',
    '/api/auth/logout',
    '/login.html',
    '/login'
  ];

  if (publicEndpoints.some(endpoint => req.path.startsWith(endpoint))) {
    return next();
  }

  // Try to get token from Authorization header
  let token = null;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    logger.warn(`Authentication failed for ${req.method} ${req.path}: No token provided`);
    return res.status(401).json({
      error: 'Unauthorized',
      code: 'MISSING_TOKEN',
      timestamp: new Date().toISOString()
    });
  }

  // Verify token
  const verification = authService.verifyJWT(token);

  if (!verification.valid) {
    logger.warn(`Authentication failed for ${req.method} ${req.path}: Invalid token`);
    return res.status(401).json({
      error: 'Unauthorized',
      code: 'INVALID_TOKEN',
      details: verification.error,
      timestamp: new Date().toISOString()
    });
  }

  // Attach user to request
  req.user = {
    id: verification.payload.sub,
    email: verification.payload.email,
    type: verification.payload.type
  };

  logger.debug(`Authenticated user ${req.user.email} for ${req.method} ${req.path}`);
  next();
}

/**
 * Optional authentication middleware
 * Checks for JWT but doesn't fail if missing
 * Useful for endpoints that work with or without auth
 */
function optionalAuthMiddleware(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (token) {
    const verification = authService.verifyJWT(token);
    if (verification.valid) {
      req.user = {
        id: verification.payload.sub,
        email: verification.payload.email,
        type: verification.payload.type
      };
    }
  }

  next();
}

/**
 * Service agent authentication middleware
 * Validates API key for service agents (machine identities)
 */
function serviceAgentAuthMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      code: 'MISSING_API_KEY',
      timestamp: new Date().toISOString()
    });
  }

  // TODO: Validate API key against database when service agents are implemented
  // For now, log that it would be validated
  logger.debug('Service agent authentication via API key');

  next();
}

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
  serviceAgentAuthMiddleware
};
