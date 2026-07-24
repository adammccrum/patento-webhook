/**
 * Permission Enforcement Middleware
 * Checks if authenticated user has required permission
 */

const logger = require('../utils/logger');
const rbacEngine = require('../authorization/rbac-engine');

/**
 * Middleware factory - requires specific permission
 * Usage: app.get('/api/objectives/:id/pause', requirePermission('objective:pause'), controller)
 */
function requirePermission(action, resource = null) {
  return async (req, res, next) => {
    // Must be authenticated (authMiddleware runs before this)
    if (!req.user) {
      logger.warn(`Permission check requires authentication for ${action}:${resource}`);
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'MISSING_TOKEN',
        timestamp: new Date().toISOString()
      });
    }

    try {
      const hasPermission = await rbacEngine.hasPermission(req.user.id, action, resource);

      if (!hasPermission) {
        logger.warn(`Permission denied for user ${req.user.email}: ${action}:${resource}`);
        return res.status(403).json({
          error: 'Forbidden',
          code: 'PERMISSION_DENIED',
          action,
          resource,
          message: `You do not have permission for: ${action}`,
          timestamp: new Date().toISOString()
        });
      }

      logger.debug(`Permission granted for user ${req.user.email}: ${action}:${resource}`);
      next();
    } catch (error) {
      logger.error(`Permission check failed: ${error.message}`);
      return res.status(500).json({
        error: 'Internal Server Error',
        code: 'PERMISSION_CHECK_FAILED',
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * Middleware factory - requires one of multiple permissions
 * Usage: app.post('/api/objectives', requireAnyPermission(['objective:create', 'system:admin']), controller)
 */
function requireAnyPermission(actions) {
  return async (req, res, next) => {
    if (!req.user) {
      logger.warn(`Permission check requires authentication`);
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'MISSING_TOKEN',
        timestamp: new Date().toISOString()
      });
    }

    try {
      for (const action of actions) {
        const hasPermission = await rbacEngine.hasPermission(req.user.id, action);
        if (hasPermission) {
          logger.debug(`Permission granted for user ${req.user.email}: ${action}`);
          return next();
        }
      }

      logger.warn(`Permission denied for user ${req.user.email} for any of: ${actions.join(', ')}`);
      return res.status(403).json({
        error: 'Forbidden',
        code: 'PERMISSION_DENIED',
        actions,
        message: `You do not have permission for any of: ${actions.join(', ')}`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Permission check failed: ${error.message}`);
      return res.status(500).json({
        error: 'Internal Server Error',
        code: 'PERMISSION_CHECK_FAILED',
        timestamp: new Date().toISOString()
      });
    }
  };
}

module.exports = {
  requirePermission,
  requireAnyPermission
};
