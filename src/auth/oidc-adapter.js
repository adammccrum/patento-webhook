/**
 * OIDC Adapter - OpenID Connect integration (stub for Phase 4)
 * Will be implemented when OIDC provider connection is needed
 */

const logger = require('../utils/logger');

/**
 * Initialize OIDC configuration
 */
function initializeOIDC(config) {
  logger.info('OIDC adapter initialized (stub - no provider connected)');
  logger.warn('OIDC authentication is not active. Set FEATURE_OIDC_ENABLED=true and configure OIDC provider to enable.');

  return {
    enabled: false,
    provider: null,
    metadata: null
  };
}

/**
 * Get OIDC authorization URL
 */
function getAuthorizationUrl(state, nonce) {
  logger.warn('OIDC getAuthorizationUrl called but OIDC not connected');
  throw new Error('OIDC provider not configured');
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeAuthorizationCode(code, codeVerifier) {
  logger.warn('OIDC exchangeAuthorizationCode called but OIDC not connected');
  throw new Error('OIDC provider not configured');
}

/**
 * Refresh access token using refresh token
 */
async function refreshOIDCToken(refreshToken) {
  logger.warn('OIDC refreshOIDCToken called but OIDC not connected');
  throw new Error('OIDC provider not configured');
}

/**
 * Validate ID token
 */
function validateIDToken(idToken) {
  logger.warn('OIDC validateIDToken called but OIDC not connected');
  throw new Error('OIDC provider not configured');
}

module.exports = {
  initializeOIDC,
  getAuthorizationUrl,
  exchangeAuthorizationCode,
  refreshOIDCToken,
  validateIDToken
};
