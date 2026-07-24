/**
 * Security Logger - Logs security-relevant events for audit trail
 * Records authentication, authorization, and access control events
 */

const logger = require('../utils/logger');
const { getDatabase } = require('../database/database');
const { v4: uuid } = require('uuid');

/**
 * Log successful authentication
 */
async function logAuthSuccess(userId, email, ipAddress, userAgent) {
  const db = getDatabase();
  if (!db) {
    logger.info(`[AUTH_SUCCESS] User ${email} authenticated from ${ipAddress}`);
    return;
  }

  try {
    await db('audit_events').insert({
      id: uuid(),
      sequence: null, // Will be set by database trigger
      timestamp: new Date(),
      actor_id: userId,
      actor_type: 'user',
      agent: null,
      action: 'auth:success',
      resource_type: 'session',
      resource_id: null,
      permission: null,
      auth_ref: null,
      prev_hash: null,
      event_hash: null,
      correlation_id: null,
      status: 'success',
      details: {
        email,
        ipAddress,
        userAgent
      }
    });

    logger.info(`[AUTH_SUCCESS] User ${email} authenticated`);
  } catch (error) {
    logger.error(`Failed to log auth success: ${error.message}`);
  }
}

/**
 * Log failed authentication attempt
 */
async function logAuthFailure(email, ipAddress, reason) {
  const db = getDatabase();
  if (!db) {
    logger.warn(`[AUTH_FAILURE] Authentication failed for ${email}: ${reason} from ${ipAddress}`);
    return;
  }

  try {
    await db('audit_events').insert({
      id: uuid(),
      sequence: null,
      timestamp: new Date(),
      actor_id: null,
      actor_type: 'system',
      agent: null,
      action: 'auth:failure',
      resource_type: 'session',
      resource_id: null,
      permission: null,
      auth_ref: null,
      prev_hash: null,
      event_hash: null,
      correlation_id: null,
      status: 'failed',
      details: {
        email,
        ipAddress,
        reason
      }
    });

    logger.warn(`[AUTH_FAILURE] Authentication failed for ${email}: ${reason}`);
  } catch (error) {
    logger.error(`Failed to log auth failure: ${error.message}`);
  }
}

/**
 * Log user logout
 */
async function logLogout(userId, email, ipAddress) {
  const db = getDatabase();
  if (!db) {
    logger.info(`[LOGOUT] User ${email} logged out`);
    return;
  }

  try {
    await db('audit_events').insert({
      id: uuid(),
      sequence: null,
      timestamp: new Date(),
      actor_id: userId,
      actor_type: 'user',
      agent: null,
      action: 'auth:logout',
      resource_type: 'session',
      resource_id: null,
      permission: null,
      auth_ref: null,
      prev_hash: null,
      event_hash: null,
      correlation_id: null,
      status: 'success',
      details: {
        email,
        ipAddress
      }
    });

    logger.info(`[LOGOUT] User ${email} logged out`);
  } catch (error) {
    logger.error(`Failed to log logout: ${error.message}`);
  }
}

/**
 * Log session expiry
 */
async function logSessionExpiry(userId, sessionId) {
  const db = getDatabase();
  if (!db) {
    logger.info(`[SESSION_EXPIRED] Session expired for user ${userId}`);
    return;
  }

  try {
    await db('audit_events').insert({
      id: uuid(),
      sequence: null,
      timestamp: new Date(),
      actor_id: userId,
      actor_type: 'system',
      agent: null,
      action: 'session:expired',
      resource_type: 'session',
      resource_id: sessionId,
      permission: null,
      auth_ref: null,
      prev_hash: null,
      event_hash: null,
      correlation_id: null,
      status: 'success',
      details: {
        userId,
        sessionId
      }
    });

    logger.info(`[SESSION_EXPIRED] Session expired for user ${userId}`);
  } catch (error) {
    logger.error(`Failed to log session expiry: ${error.message}`);
  }
}

/**
 * Log session revocation
 */
async function logSessionRevocation(userId, revokedBy, reason) {
  const db = getDatabase();
  if (!db) {
    logger.warn(`[SESSION_REVOKED] Session revoked for user ${userId}: ${reason}`);
    return;
  }

  try {
    await db('audit_events').insert({
      id: uuid(),
      sequence: null,
      timestamp: new Date(),
      actor_id: revokedBy,
      actor_type: 'user',
      agent: null,
      action: 'session:revoked',
      resource_type: 'session',
      resource_id: userId,
      permission: null,
      auth_ref: null,
      prev_hash: null,
      event_hash: null,
      correlation_id: null,
      status: 'success',
      details: {
        userId,
        revokedBy,
        reason
      }
    });

    logger.warn(`[SESSION_REVOKED] Session revoked for user ${userId}: ${reason}`);
  } catch (error) {
    logger.error(`Failed to log session revocation: ${error.message}`);
  }
}

/**
 * Log permission denied event
 */
async function logPermissionDenied(userId, action, resource, ipAddress) {
  const db = getDatabase();
  if (!db) {
    logger.warn(`[PERMISSION_DENIED] User ${userId} denied ${action}:${resource} from ${ipAddress}`);
    return;
  }

  try {
    await db('audit_events').insert({
      id: uuid(),
      sequence: null,
      timestamp: new Date(),
      actor_id: userId,
      actor_type: 'user',
      agent: null,
      action: 'auth:permission_denied',
      resource_type: resource || 'unknown',
      resource_id: null,
      permission: action,
      auth_ref: null,
      prev_hash: null,
      event_hash: null,
      correlation_id: null,
      status: 'denied',
      details: {
        userId,
        action,
        resource,
        ipAddress
      }
    });

    logger.warn(`[PERMISSION_DENIED] User ${userId} denied ${action}:${resource}`);
  } catch (error) {
    logger.error(`Failed to log permission denied: ${error.message}`);
  }
}

/**
 * Log rate limit violation
 */
async function logRateLimitViolation(ipAddress, endpoint, attempts) {
  const db = getDatabase();
  if (!db) {
    logger.warn(`[RATE_LIMIT] IP ${ipAddress} exceeded limit on ${endpoint}: ${attempts} attempts`);
    return;
  }

  try {
    await db('audit_events').insert({
      id: uuid(),
      sequence: null,
      timestamp: new Date(),
      actor_id: null,
      actor_type: 'system',
      agent: null,
      action: 'security:rate_limit_exceeded',
      resource_type: 'endpoint',
      resource_id: endpoint,
      permission: null,
      auth_ref: null,
      prev_hash: null,
      event_hash: null,
      correlation_id: null,
      status: 'blocked',
      details: {
        ipAddress,
        endpoint,
        attempts
      }
    });

    logger.warn(`[RATE_LIMIT] IP ${ipAddress} exceeded limit on ${endpoint}`);
  } catch (error) {
    logger.error(`Failed to log rate limit violation: ${error.message}`);
  }
}

/**
 * Log WebSocket authentication failure
 */
async function logWebSocketAuthFailure(clientIp, reason) {
  const db = getDatabase();
  if (!db) {
    logger.warn(`[WS_AUTH_FAILURE] WebSocket auth failed from ${clientIp}: ${reason}`);
    return;
  }

  try {
    await db('audit_events').insert({
      id: uuid(),
      sequence: null,
      timestamp: new Date(),
      actor_id: null,
      actor_type: 'system',
      agent: null,
      action: 'websocket:auth_failed',
      resource_type: 'websocket',
      resource_id: clientIp,
      permission: null,
      auth_ref: null,
      prev_hash: null,
      event_hash: null,
      correlation_id: null,
      status: 'failed',
      details: {
        clientIp,
        reason
      }
    });

    logger.warn(`[WS_AUTH_FAILURE] WebSocket auth failed: ${reason}`);
  } catch (error) {
    logger.error(`Failed to log WebSocket auth failure: ${error.message}`);
  }
}

/**
 * Log audit chain verification failure (tampering detected)
 */
async function logAuditChainVerificationFailure(eventId, expectedHash, actualHash) {
  const db = getDatabase();
  if (!db) {
    logger.error(`[AUDIT_TAMPERING] Hash chain verification failed for event ${eventId}`);
    return;
  }

  try {
    await db('audit_events').insert({
      id: uuid(),
      sequence: null,
      timestamp: new Date(),
      actor_id: null,
      actor_type: 'system',
      agent: null,
      action: 'security:audit_tampering_detected',
      resource_type: 'audit_event',
      resource_id: eventId,
      permission: null,
      auth_ref: null,
      prev_hash: null,
      event_hash: null,
      correlation_id: null,
      status: 'alert',
      details: {
        eventId,
        expectedHash,
        actualHash,
        message: 'Audit event hash chain verification failed - possible tampering detected'
      }
    });

    logger.error(`[AUDIT_TAMPERING] Hash mismatch detected for event ${eventId}`);
  } catch (error) {
    logger.error(`Failed to log audit tampering: ${error.message}`);
  }
}

module.exports = {
  logAuthSuccess,
  logAuthFailure,
  logLogout,
  logSessionExpiry,
  logSessionRevocation,
  logPermissionDenied,
  logRateLimitViolation,
  logWebSocketAuthFailure,
  logAuditChainVerificationFailure
};
