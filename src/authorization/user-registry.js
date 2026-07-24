/**
 * User Registry - Manages user registration, role assignment, and user queries
 * Mirrors AgentRegistry pattern for consistency
 */

const logger = require('../utils/logger');
const { getDatabase } = require('../database/database');
const authService = require('../auth/auth-service');
const { ValidationError } = require('../utils/errors');
const { v4: uuid } = require('uuid');

/**
 * Register new user
 */
async function registerUser(email, password, fullName = null) {
  const db = getDatabase();
  const userId = uuid();

  try {
    const existingUser = await db('users').where({ email }).first();
    if (existingUser) {
      throw new ValidationError(`User with email ${email} already exists`, 'USER_EXISTS');
    }

    const passwordHash = await authService.hashPassword(password);

    await db('users').insert({
      id: userId,
      email,
      password_hash: passwordHash,
      full_name: fullName,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    });

    logger.info(`User registered: ${email}`);
    return { id: userId, email, fullName };
  } catch (error) {
    logger.error(`User registration failed: ${error.message}`);
    throw error;
  }
}

/**
 * Get user by ID
 */
async function getUser(userId) {
  const db = getDatabase();

  try {
    const user = await db('users').where({ id: userId }).first();
    if (!user) {
      return null;
    }

    const roles = await db('roles')
      .join('user_roles', 'roles.id', '=', 'user_roles.role_id')
      .where('user_roles.user_id', userId)
      .select('roles.id', 'roles.name');

    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      isActive: user.is_active,
      roles: roles.map(r => ({ id: r.id, name: r.name })),
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };
  } catch (error) {
    logger.error(`Failed to get user: ${error.message}`);
    return null;
  }
}

/**
 * Get user by email
 */
async function getUserByEmail(email) {
  const db = getDatabase();

  try {
    const user = await db('users').where({ email }).first();
    if (!user) {
      return null;
    }

    const roles = await db('roles')
      .join('user_roles', 'roles.id', '=', 'user_roles.role_id')
      .where('user_roles.user_id', user.id)
      .select('roles.id', 'roles.name');

    return {
      id: user.id,
      email: user.email,
      passwordHash: user.password_hash,
      fullName: user.full_name,
      isActive: user.is_active,
      roles: roles.map(r => ({ id: r.id, name: r.name })),
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };
  } catch (error) {
    logger.error(`Failed to get user by email: ${error.message}`);
    return null;
  }
}

/**
 * Update user profile
 */
async function updateUser(userId, updates) {
  const db = getDatabase();

  try {
    const allowedFields = ['full_name', 'email', 'is_active'];
    const safeUpdates = {};

    for (const key in updates) {
      if (allowedFields.includes(key)) {
        safeUpdates[key] = updates[key];
      }
    }

    safeUpdates.updated_at = new Date();

    await db('users').where({ id: userId }).update(safeUpdates);

    logger.info(`User ${userId} updated`);
    return await getUser(userId);
  } catch (error) {
    logger.error(`Failed to update user: ${error.message}`);
    throw error;
  }
}

/**
 * Deactivate user
 */
async function deactivateUser(userId) {
  const db = getDatabase();

  try {
    await db('users').where({ id: userId }).update({
      is_active: false,
      updated_at: new Date()
    });

    logger.info(`User ${userId} deactivated`);
    return { success: true };
  } catch (error) {
    logger.error(`Failed to deactivate user: ${error.message}`);
    throw error;
  }
}

/**
 * Activate user
 */
async function activateUser(userId) {
  const db = getDatabase();

  try {
    await db('users').where({ id: userId }).update({
      is_active: true,
      updated_at: new Date()
    });

    logger.info(`User ${userId} activated`);
    return { success: true };
  } catch (error) {
    logger.error(`Failed to activate user: ${error.message}`);
    throw error;
  }
}

/**
 * List all users
 */
async function listUsers(limit = 100, offset = 0) {
  const db = getDatabase();

  try {
    const users = await db('users')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .select('id', 'email', 'full_name', 'is_active', 'created_at', 'updated_at');

    const count = await db('users').count('* as total').first();

    return {
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        isActive: u.is_active,
        createdAt: u.created_at,
        updatedAt: u.updated_at
      })),
      total: count.total,
      limit,
      offset
    };
  } catch (error) {
    logger.error(`Failed to list users: ${error.message}`);
    return { users: [], total: 0, limit, offset };
  }
}

/**
 * Delete user (cascades to sessions and role assignments)
 */
async function deleteUser(userId) {
  const db = getDatabase();

  try {
    await db('users').where({ id: userId }).delete();

    logger.info(`User ${userId} deleted`);
    return { success: true };
  } catch (error) {
    logger.error(`Failed to delete user: ${error.message}`);
    throw error;
  }
}

module.exports = {
  registerUser,
  getUser,
  getUserByEmail,
  updateUser,
  deactivateUser,
  activateUser,
  listUsers,
  deleteUser
};
