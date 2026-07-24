/**
 * Rate Limiting Middleware
 * Per-user and per-IP rate limiting with sliding window
 */

const logger = require('../utils/logger');

// In-memory storage: key -> { count, resetAt }
const userLimitMap = new Map();
const ipLimitMap = new Map();

const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== 'false';
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000');
const RATE_LIMIT_MAX_REQUESTS_USER = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS_USER || '100');
const RATE_LIMIT_MAX_REQUESTS_IP = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS_IP || '1000');

/**
 * Get client IP address
 */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         req.connection.remoteAddress;
}

/**
 * Clean expired entries from map
 */
function cleanExpiredEntries(map, now) {
  for (const [key, value] of map.entries()) {
    if (value.resetAt <= now) {
      map.delete(key);
    }
  }
}

/**
 * Rate limiting middleware
 */
function rateLimitMiddleware(req, res, next) {
  if (!RATE_LIMIT_ENABLED) {
    return next();
  }

  const now = Date.now();
  const userId = req.user?.id;
  const clientIp = getClientIp(req);

  // Periodically clean expired entries
  if (Math.random() < 0.01) {
    cleanExpiredEntries(userLimitMap, now);
    cleanExpiredEntries(ipLimitMap, now);
  }

  // Check user rate limit (if authenticated)
  if (userId) {
    const userKey = `user:${userId}`;
    let userLimit = userLimitMap.get(userKey);

    if (!userLimit || userLimit.resetAt <= now) {
      userLimit = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
      userLimitMap.set(userKey, userLimit);
    }

    userLimit.count++;

    if (userLimit.count > RATE_LIMIT_MAX_REQUESTS_USER) {
      const retryAfter = Math.ceil((userLimit.resetAt - now) / 1000);
      logger.warn(`Rate limit exceeded for user ${userId}: ${userLimit.count} requests in ${RATE_LIMIT_WINDOW_MS}ms`);

      return res.status(429).json({
        error: 'Too Many Requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter,
        limit: RATE_LIMIT_MAX_REQUESTS_USER,
        window: RATE_LIMIT_WINDOW_MS,
        timestamp: new Date().toISOString()
      }).set('Retry-After', retryAfter);
    }
  }

  // Check IP rate limit (always)
  const ipKey = `ip:${clientIp}`;
  let ipLimit = ipLimitMap.get(ipKey);

  if (!ipLimit || ipLimit.resetAt <= now) {
    ipLimit = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    ipLimitMap.set(ipKey, ipLimit);
  }

  ipLimit.count++;

  if (ipLimit.count > RATE_LIMIT_MAX_REQUESTS_IP) {
    const retryAfter = Math.ceil((ipLimit.resetAt - now) / 1000);
    logger.warn(`Rate limit exceeded for IP ${clientIp}: ${ipLimit.count} requests in ${RATE_LIMIT_WINDOW_MS}ms`);

    return res.status(429).json({
      error: 'Too Many Requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter,
      limit: RATE_LIMIT_MAX_REQUESTS_IP,
      window: RATE_LIMIT_WINDOW_MS,
      timestamp: new Date().toISOString()
    }).set('Retry-After', retryAfter);
  }

  // Attach rate limit info to response headers
  res.setHeader('RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS_USER);
  res.setHeader('RateLimit-Remaining', RATE_LIMIT_MAX_REQUESTS_USER - (userLimit?.count || 0));
  res.setHeader('RateLimit-Reset', Math.ceil((userLimit?.resetAt || now + RATE_LIMIT_WINDOW_MS) / 1000));

  next();
}

/**
 * Get current rate limit stats (for monitoring)
 */
function getRateLimitStats() {
  return {
    userLimitCount: userLimitMap.size,
    ipLimitCount: ipLimitMap.size,
    enabled: RATE_LIMIT_ENABLED,
    windowMs: RATE_LIMIT_WINDOW_MS,
    maxRequestsPerUser: RATE_LIMIT_MAX_REQUESTS_USER,
    maxRequestsPerIP: RATE_LIMIT_MAX_REQUESTS_IP
  };
}

module.exports = {
  rateLimitMiddleware,
  getRateLimitStats
};
