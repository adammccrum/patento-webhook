/**
 * Authentication service
 * Handles JWT generation, password hashing, session management
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuid } = require('uuid');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { getDatabase } = require('../database/database');

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY_SECONDS || 900; // 15 minutes
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY_SECONDS || 604800; // 7 days
const SESSION_MAX_AGE = process.env.SESSION_MAX_AGE_MS || 86400000; // 24 hours

/**
 * Hash password using bcrypt
 */
async function hashPassword(password) {
  try {
    const hash = await bcrypt.hash(password, 12);
    return hash;
  } catch (error) {
    logger.error(`Password hashing failed: ${error.message}`);
    throw error;
  }
}

/**
 * Verify password against hash
 */
async function verifyPassword(password, hash) {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    logger.error(`Password verification failed: ${error.message}`);
    return false;
  }
}

/**
 * Generate JWT access token
 */
function generateAccessToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    type: 'access'
  };

  try {
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: `${ACCESS_TOKEN_EXPIRY}s`,
      issuer: 'patento-orchestration',
      audience: 'patento-dashboard'
    });
    return token;
  } catch (error) {
    logger.error(`Access token generation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Generate JWT refresh token
 */
function generateRefreshToken(user) {
  const payload = {
    sub: user.id,
    type: 'refresh',
    nonce: uuid() // One-time use nonce
  };

  try {
    const token = jwt.sign(payload, JWT_REFRESH_SECRET, {
      expiresIn: `${REFRESH_TOKEN_EXPIRY}s`,
      issuer: 'patento-orchestration'
    });
    return token;
  } catch (error) {
    logger.error(`Refresh token generation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Verify JWT token
 */
function verifyJWT(token, secret = JWT_SECRET) {
  try {
    const decoded = jwt.verify(token, secret, {
      issuer: 'patento-orchestration'
    });
    return { valid: true, payload: decoded };
  } catch (error) {
    logger.debug(`JWT verification failed: ${error.message}`);
    return { valid: false, error: error.message };
  }
}

/**
 * Hash token for storage
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create session in database
 */
async function createSession(userId, ipAddress = null, userAgent = null) {
  const db = getDatabase();
  const sessionId = uuid();
  const tokenHash = hashToken(sessionId);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE);

  try {
    await db('sessions').insert({
      id: sessionId,
      user_id: userId,
      token_hash: tokenHash,
      ip_address: ipAddress,
      user_agent: userAgent,
      expires_at: expiresAt,
      created_at: new Date()
    });

    logger.info(`Session created for user ${userId}`);
    return {
      sessionId,
      expiresAt
    };
  } catch (error) {
    logger.error(`Session creation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Validate session
 */
async function validateSession(sessionId) {
  const db = getDatabase();
  const tokenHash = hashToken(sessionId);

  try {
    const session = await db('sessions')
      .where({ token_hash: tokenHash })
      .first();

    if (!session) {
      return { valid: false, reason: 'Session not found' };
    }

    if (session.revoked_at) {
      return { valid: false, reason: 'Session revoked' };
    }

    if (new Date(session.expires_at) < new Date()) {
      return { valid: false, reason: 'Session expired' };
    }

    return { valid: true, session };
  } catch (error) {
    logger.error(`Session validation failed: ${error.message}`);
    return { valid: false, reason: error.message };
  }
}

/**
 * Revoke session
 */
async function revokeSession(sessionId, reason = null) {
  const db = getDatabase();
  const tokenHash = hashToken(sessionId);

  try {
    await db('sessions')
      .where({ token_hash: tokenHash })
      .update({
        revoked_at: new Date(),
        revocation_reason: reason
      });

    logger.info(`Session revoked: ${reason || 'no reason'}`);
    return { success: true };
  } catch (error) {
    logger.error(`Session revocation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(refreshToken) {
  const verification = verifyJWT(refreshToken, JWT_REFRESH_SECRET);

  if (!verification.valid) {
    logger.warn('Refresh token verification failed');
    return { success: false, error: 'Invalid refresh token' };
  }

  try {
    const db = getDatabase();
    const user = await db('users').where({ id: verification.payload.sub }).first();

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (!user.is_active) {
      return { success: false, error: 'User account is inactive' };
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    return {
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY
    };
  } catch (error) {
    logger.error(`Token refresh failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyJWT,
  hashToken,
  createSession,
  validateSession,
  revokeSession,
  refreshAccessToken
};
