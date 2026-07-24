/**
 * IrisKey Authorization Adapter
 * Handles biometric identity verification and authorization approvals
 * STUB: Mock implementation until real IrisKey service connection active
 */

const logger = require('../utils/logger');
const { v4: uuid } = require('uuid');

const REAL_CONNECTION = process.env.IRISKEY_REAL_CONNECTION === 'true';

const STATUS_VALUES = {
  UNVERIFIED: 'unverified',
  VERIFIED: 'verified',
  POLICY_DENIED: 'policy_denied',
  AWAITING_AUTHORIZATION: 'awaiting_authorisation',
  APPROVED: 'approved',
  DENIED: 'denied',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
  EXECUTION_COMPLETED: 'execution_completed',
  EXECUTION_FAILED: 'execution_failed'
};

if (!REAL_CONNECTION) {
  logger.warn('⚠️  Using MOCK IrisKey adapter - biometric verification NOT ACTIVE');
  logger.warn('Set IRISKEY_REAL_CONNECTION=true to enable real IrisKey service connection');
}

/**
 * Request biometric identity verification
 */
async function requestIdentity(agentCode) {
  const requestId = uuid();

  if (REAL_CONNECTION) {
    logger.debug(`IrisKey: Requesting identity verification for agent ${agentCode}`);
    // Real implementation would call IrisKey service
    throw new Error('Real IrisKey connection not yet implemented');
  }

  logger.debug(`[MOCK] IrisKey identity request ${requestId} for agent ${agentCode}`);

  return {
    requestId,
    status: STATUS_VALUES.UNVERIFIED,
    agent: agentCode,
    correlationId: uuid(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
  };
}

/**
 * Verify biometric data against identity request
 */
async function verifyIdentity(requestId, biometricData) {
  if (REAL_CONNECTION) {
    logger.debug(`IrisKey: Verifying identity for request ${requestId}`);
    // Real implementation would validate against biometric service
    throw new Error('Real IrisKey connection not yet implemented');
  }

  logger.debug(`[MOCK] IrisKey identity verification for request ${requestId}`);

  // Mock: Always return unverified unless explicitly bypassed in tests
  return {
    requestId,
    status: STATUS_VALUES.UNVERIFIED,
    verified: false,
    identity: null,
    reason: 'Mock IrisKey adapter - biometric verification not active'
  };
}

/**
 * Get verification status of an identity request
 */
async function getVerifiedIdentityStatus(requestId) {
  if (REAL_CONNECTION) {
    logger.debug(`IrisKey: Getting identity status for request ${requestId}`);
    throw new Error('Real IrisKey connection not yet implemented');
  }

  logger.debug(`[MOCK] IrisKey get identity status for request ${requestId}`);

  return {
    requestId,
    status: STATUS_VALUES.UNVERIFIED,
    verified: false
  };
}

/**
 * Request authorization for high-risk action
 */
async function requestAuthorization(identity, action, riskLevel) {
  const authorizationId = uuid();

  if (REAL_CONNECTION) {
    logger.debug(`IrisKey: Requesting authorization for action ${action} (risk: ${riskLevel})`);
    throw new Error('Real IrisKey connection not yet implemented');
  }

  logger.debug(`[MOCK] IrisKey authorization request ${authorizationId} for action ${action} (risk: ${riskLevel})`);

  // Default deny policy
  const approvalRequired = riskLevel === 'high' || riskLevel === 'medium';

  return {
    authorizationId,
    status: approvalRequired ? STATUS_VALUES.AWAITING_AUTHORIZATION : STATUS_VALUES.APPROVED,
    action,
    permission: `${action}:execute`,
    riskLevel,
    approvalRequired,
    approvalLevels: riskLevel === 'high' ? 2 : 1,
    escalationRequired: riskLevel === 'high',
    authAssuranceLevel: REAL_CONNECTION ? 4 : 0,
    constraintDecision: {
      approvalRequired,
      escalationRequired: riskLevel === 'high',
      maxApprovers: riskLevel === 'high' ? 3 : 1
    },
    correlationId: uuid(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  };
}

/**
 * Approve authorization request
 */
async function approveAuthorization(authorizationId, approverIdentity, signature = null) {
  if (REAL_CONNECTION) {
    logger.debug(`IrisKey: Approving authorization ${authorizationId}`);
    throw new Error('Real IrisKey connection not yet implemented');
  }

  logger.debug(`[MOCK] IrisKey authorization approval ${authorizationId}`);

  return {
    authorizationId,
    status: STATUS_VALUES.APPROVED,
    approvedBy: approverIdentity,
    approvedAt: new Date(),
    signature: signature || null,
    proofReference: null
  };
}

/**
 * Deny authorization request
 */
async function denyAuthorization(authorizationId, denialReason) {
  if (REAL_CONNECTION) {
    logger.debug(`IrisKey: Denying authorization ${authorizationId}`);
    throw new Error('Real IrisKey connection not yet implemented');
  }

  logger.debug(`[MOCK] IrisKey authorization denial ${authorizationId}: ${denialReason}`);

  return {
    authorizationId,
    status: STATUS_VALUES.DENIED,
    denialReason,
    deniedAt: new Date()
  };
}

/**
 * Revoke previous authorization
 */
async function revokeAuthorization(authorizationId, reason = null) {
  if (REAL_CONNECTION) {
    logger.debug(`IrisKey: Revoking authorization ${authorizationId}`);
    throw new Error('Real IrisKey connection not yet implemented');
  }

  logger.debug(`[MOCK] IrisKey authorization revocation ${authorizationId}: ${reason || 'no reason'}`);

  return {
    authorizationId,
    status: STATUS_VALUES.REVOKED,
    revokedAt: new Date(),
    revocationReason: reason
  };
}

/**
 * Get authorization status
 */
async function getAuthorizationStatus(authorizationId) {
  if (REAL_CONNECTION) {
    logger.debug(`IrisKey: Getting authorization status ${authorizationId}`);
    throw new Error('Real IrisKey connection not yet implemented');
  }

  logger.debug(`[MOCK] IrisKey get authorization status ${authorizationId}`);

  return {
    authorizationId,
    status: STATUS_VALUES.AWAITING_AUTHORIZATION,
    action: 'unknown',
    riskLevel: 'unknown',
    approvalRequired: true
  };
}

/**
 * Verify authorization approval signature
 */
async function verifySignature(authorizationId, signature) {
  if (REAL_CONNECTION) {
    logger.debug(`IrisKey: Verifying signature for authorization ${authorizationId}`);
    throw new Error('Real IrisKey connection not yet implemented');
  }

  logger.debug(`[MOCK] IrisKey signature verification for authorization ${authorizationId}`);

  return {
    authorizationId,
    valid: false,
    reason: 'Mock IrisKey adapter - signature verification not active'
  };
}

module.exports = {
  requestIdentity,
  verifyIdentity,
  getVerifiedIdentityStatus,
  requestAuthorization,
  approveAuthorization,
  denyAuthorization,
  revokeAuthorization,
  getAuthorizationStatus,
  verifySignature,
  STATUS_VALUES,
  REAL_CONNECTION
};
