/**
 * RBAC Engine - Role-Based Access Control
 * Checks permissions based on user roles
 */

const logger = require('../utils/logger');
const { getDatabase } = require('../database/database');
const { AuthorizationError } = require('../utils/errors');

/**
 * Get all roles for a user
 */
async function getUserRoles(userId) {
  const db = getDatabase();

  try {
    const roles = await db('roles')
      .join('user_roles', 'roles.id', '=', 'user_roles.role_id')
      .where('user_roles.user_id', userId)
      .select('roles.id', 'roles.name', 'roles.description');

    return roles;
  } catch (error) {
    logger.error(`Failed to get user roles: ${error.message}`);
    return [];
  }
}

/**
 * Get all permissions for a user (through their roles)
 */
async function getUserPermissions(userId) {
  const db = getDatabase();

  try {
    const permissions = await db('permissions')
      .join('role_permissions', 'permissions.id', '=', 'role_permissions.permission_id')
      .join('user_roles', 'role_permissions.role_id', '=', 'user_roles.role_id')
      .where('user_roles.user_id', userId)
      .select('permissions.id', 'permissions.action', 'permissions.resource')
      .distinct();

    return permissions;
  } catch (error) {
    logger.error(`Failed to get user permissions: ${error.message}`);
    return [];
  }
}

/**
 * Check if user has a specific permission
 */
async function hasPermission(userId, action, resource = null) {
  const db = getDatabase();

  try {
    // Owner has all permissions
    const roles = await getUserRoles(userId);
    if (roles.some(r => r.name === 'owner')) {
      logger.debug(`Owner ${userId} has implicit permission for ${action}:${resource}`);
      return true;
    }

    // Get permissions
    const permissions = await getUserPermissions(userId);

    // Check for exact match
    const hasExact = permissions.some(p =>
      p.action === action && (!resource || p.resource === resource)
    );

    if (hasExact) {
      return true;
    }

    // Check for wildcard permissions (action:*)
    const hasWildcard = permissions.some(p =>
      p.action === action && p.resource === '*'
    );

    return hasWildcard;
  } catch (error) {
    logger.error(`Permission check failed: ${error.message}`);
    return false;
  }
}

/**
 * Enforce permission - throw if denied
 */
async function enforcePermission(userId, action, resource = null) {
  const allowed = await hasPermission(userId, action, resource);

  if (!allowed) {
    const userInfo = { userId, action, resource };
    logger.warn(`Permission denied for user ${userId}: ${action}:${resource}`);
    throw new AuthorizationError(
      `Insufficient permissions for action: ${action}`,
      'PERMISSION_DENIED',
      userInfo
    );
  }

  return true;
}

/**
 * Assign role to user
 */
async function assignRole(userId, roleId) {
  const db = getDatabase();

  try {
    await db('user_roles').insert({
      user_id: userId,
      role_id: roleId,
      assigned_at: new Date()
    });

    logger.info(`Role ${roleId} assigned to user ${userId}`);
    return { success: true };
  } catch (error) {
    logger.error(`Failed to assign role: ${error.message}`);
    throw error;
  }
}

/**
 * Revoke role from user
 */
async function revokeRole(userId, roleId) {
  const db = getDatabase();

  try {
    await db('user_roles')
      .where({ user_id: userId, role_id: roleId })
      .delete();

    logger.info(`Role ${roleId} revoked from user ${userId}`);
    return { success: true };
  } catch (error) {
    logger.error(`Failed to revoke role: ${error.message}`);
    throw error;
  }
}

/**
 * Get users by role
 */
async function getUsersByRole(roleId) {
  const db = getDatabase();

  try {
    const users = await db('users')
      .join('user_roles', 'users.id', '=', 'user_roles.user_id')
      .where('user_roles.role_id', roleId)
      .select('users.id', 'users.email', 'users.full_name', 'users.is_active');

    return users;
  } catch (error) {
    logger.error(`Failed to get users by role: ${error.message}`);
    return [];
  }
}

module.exports = {
  getUserRoles,
  getUserPermissions,
  hasPermission,
  enforcePermission,
  assignRole,
  revokeRole,
  getUsersByRole
};
