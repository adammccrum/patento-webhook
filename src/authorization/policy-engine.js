/**
 * Policy Engine - Evaluates authorization policies for actions
 * Enforces default-deny and escalation requirements
 */

const logger = require('../utils/logger');
const rbacEngine = require('./rbac-engine');

/**
 * Authorization decision result
 */
class AuthorizationDecision {
  constructor(allowed, riskLevel, requiresApproval, escalationRequired, approvalLevels = 1) {
    this.allowed = allowed;
    this.riskLevel = riskLevel;
    this.requiresApproval = requiresApproval;
    this.escalationRequired = escalationRequired;
    this.approvalLevels = approvalLevels;
    this.timestamp = new Date();
  }
}

/**
 * Policy rules - define risk levels and requirements
 */
const POLICY_RULES = {
  'objective:create': { risk: 'medium', requiresApproval: false },
  'objective:view': { risk: 'low', requiresApproval: false },
  'objective:update': { risk: 'medium', requiresApproval: false },
  'objective:pause': { risk: 'medium', requiresApproval: false },
  'objective:resume': { risk: 'medium', requiresApproval: false },
  'objective:cancel': { risk: 'high', requiresApproval: true, escalationRequired: true },
  'objective:delete': { risk: 'high', requiresApproval: true, escalationRequired: true },

  'task:create': { risk: 'low', requiresApproval: false },
  'task:view': { risk: 'low', requiresApproval: false },
  'task:update': { risk: 'medium', requiresApproval: false },
  'task:retry': { risk: 'low', requiresApproval: false },
  'task:delete': { risk: 'high', requiresApproval: true },
  'task:execute': { risk: 'medium', requiresApproval: false },

  'agent:view': { risk: 'low', requiresApproval: false },
  'agent:manage': { risk: 'high', requiresApproval: true },
  'agent:report_status': { risk: 'low', requiresApproval: false },

  'authorization:view': { risk: 'medium', requiresApproval: false },
  'authorization:approve': { risk: 'high', requiresApproval: false }, // Approval itself is high risk
  'authorization:deny': { risk: 'high', requiresApproval: false },
  'authorization:revoke': { risk: 'high', requiresApproval: true },

  'audit:view': { risk: 'medium', requiresApproval: false },
  'audit:export': { risk: 'high', requiresApproval: true },

  'provider:manage': { risk: 'high', requiresApproval: true },

  'system:admin': { risk: 'critical', requiresApproval: true, escalationRequired: true }
};

/**
 * Get policy rule for action
 */
function getPolicyRule(action) {
  return POLICY_RULES[action] || {
    risk: 'unknown',
    requiresApproval: true // Default deny for unknown actions
  };
}

/**
 * Evaluate authorization policy
 * Returns decision object with approval requirements
 */
async function evaluatePolicy(userId, action, riskLevelOverride = null) {
  try {
    // Check if user has permission first (default deny)
    const hasPermission = await rbacEngine.hasPermission(userId, action);
    if (!hasPermission) {
      logger.warn(`User ${userId} lacks permission for ${action}`);
      return new AuthorizationDecision(false, 'unknown', false, false);
    }

    // Get policy rule for action
    const rule = getPolicyRule(action);
    const riskLevel = riskLevelOverride || rule.risk;

    // Owner users bypass approval for non-critical actions
    const roles = await rbacEngine.getUserRoles(userId);
    const isOwner = roles.some(r => r.name === 'owner');

    // Critical actions (Sierra/Uniform level) always require approval, even for owners
    const isCritical = riskLevel === 'critical' || rule.escalationRequired;

    if (isOwner && !isCritical) {
      // Owner can proceed without approval for non-critical actions
      logger.debug(`Owner ${userId} granted ${action} without approval requirement`);
      return new AuthorizationDecision(true, riskLevel, false, false);
    }

    // For non-owners or critical actions, check approval requirement
    const requiresApproval = rule.requiresApproval || isCritical;
    const escalationRequired = isCritical || rule.escalationRequired;

    // Calculate approval levels based on risk
    let approvalLevels = 1;
    if (riskLevel === 'high') approvalLevels = 2;
    if (riskLevel === 'critical') approvalLevels = 3;

    logger.debug(`Policy evaluation for ${userId} on ${action}: requires_approval=${requiresApproval}, risk=${riskLevel}`);

    return new AuthorizationDecision(
      true, // Permission granted
      riskLevel,
      requiresApproval,
      escalationRequired,
      approvalLevels
    );
  } catch (error) {
    logger.error(`Policy evaluation error: ${error.message}`);
    // Default deny on error
    return new AuthorizationDecision(false, 'unknown', false, false);
  }
}

/**
 * Check if action bypasses normal approval (Sierra/Uniform protection)
 */
function isEscalationRequired(action) {
  const rule = getPolicyRule(action);
  return rule.escalationRequired === true;
}

/**
 * Cannot bypass this action through normal channels
 */
function cannotBypass(action) {
  return isEscalationRequired(action);
}

/**
 * Get risk level for action
 */
function getRiskLevel(action) {
  const rule = getPolicyRule(action);
  return rule.risk;
}

/**
 * Get all actions requiring approval
 */
function getActionsRequiringApproval() {
  return Object.entries(POLICY_RULES)
    .filter(([_, rule]) => rule.requiresApproval)
    .map(([action, _]) => action);
}

/**
 * Get all critical actions (Sierra/Uniform level)
 */
function getCriticalActions() {
  return Object.entries(POLICY_RULES)
    .filter(([_, rule]) => rule.escalationRequired || rule.risk === 'critical')
    .map(([action, _]) => action);
}

module.exports = {
  evaluatePolicy,
  getPolicyRule,
  isEscalationRequired,
  cannotBypass,
  getRiskLevel,
  getActionsRequiringApproval,
  getCriticalActions,
  AuthorizationDecision
};
