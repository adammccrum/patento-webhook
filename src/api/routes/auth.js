/**
 * Authentication API Routes
 * Login, logout, token refresh, session management
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const authService = require('../../auth/auth-service');
const userRegistry = require('../../authorization/user-registry');
const { validateRequestBody } = require('../../middleware/validation-middleware');
const Joi = require('joi');

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(1).required()
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required()
});

/**
 * POST /api/auth/login
 * Authenticate user with email and password
 */
router.post('/login', validateRequestBody(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.connection.remoteAddress;

  try {
    const user = await userRegistry.getUserByEmail(email);

    if (!user) {
      logger.warn(`Login failed for ${email}: user not found (IP: ${clientIp})`);
      return res.status(401).json({
        error: 'Invalid Credentials',
        code: 'INVALID_CREDENTIALS',
        timestamp: new Date().toISOString()
      });
    }

    if (!user.isActive) {
      logger.warn(`Login failed for ${email}: account inactive (IP: ${clientIp})`);
      return res.status(403).json({
        error: 'Account Inactive',
        code: 'ACCOUNT_INACTIVE',
        timestamp: new Date().toISOString()
      });
    }

    // Verify password
    const passwordValid = await authService.verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      logger.warn(`Login failed for ${email}: invalid password (IP: ${clientIp})`);
      return res.status(401).json({
        error: 'Invalid Credentials',
        code: 'INVALID_CREDENTIALS',
        timestamp: new Date().toISOString()
      });
    }

    // Generate tokens
    const accessToken = authService.generateAccessToken(user);
    const refreshToken = authService.generateRefreshToken(user);

    // Create session
    const session = await authService.createSession(user.id, clientIp, req.headers['user-agent']);

    logger.info(`Login successful for user ${email}`);

    // Set secure HttpOnly cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.FORCE_HTTPS === 'true',
      sameSite: 'strict',
      maxAge: parseInt(process.env.ACCESS_TOKEN_EXPIRY_SECONDS || '900') * 1000
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.FORCE_HTTPS === 'true',
      sameSite: 'strict',
      maxAge: parseInt(process.env.REFRESH_TOKEN_EXPIRY_SECONDS || '604800') * 1000
    });

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roles: user.roles
      },
      accessToken,
      refreshToken,
      expiresIn: parseInt(process.env.ACCESS_TOKEN_EXPIRY_SECONDS || '900'),
      sessionId: session.sessionId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    return res.status(500).json({
      error: 'Internal Server Error',
      code: 'LOGIN_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user and revoke session
 */
router.post('/logout', async (req, res) => {
  try {
    // Session ID can be in cookie or body
    const sessionId = req.cookies?.sessionId || req.body?.sessionId;

    if (sessionId) {
      await authService.revokeSession(sessionId, 'user logout');
    }

    logger.info(`User logged out: ${req.user?.email || 'unknown'}`);

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.clearCookie('sessionId');

    return res.json({
      success: true,
      message: 'Logged out successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Logout error: ${error.message}`);
    // Still clear cookies even if revocation failed
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.clearCookie('sessionId');

    return res.json({
      success: true,
      message: 'Logged out',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', validateRequestBody(refreshSchema), async (req, res) => {
  const { refreshToken } = req.body;

  try {
    const result = await authService.refreshAccessToken(refreshToken);

    if (!result.success) {
      logger.warn(`Token refresh failed: ${result.error}`);
      return res.status(401).json({
        error: 'Invalid Refresh Token',
        code: 'INVALID_REFRESH_TOKEN',
        reason: result.error,
        timestamp: new Date().toISOString()
      });
    }

    logger.debug(`Token refreshed for user ${req.user?.email || 'unknown'}`);

    // Set new access token cookie
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.FORCE_HTTPS === 'true',
      sameSite: 'strict',
      maxAge: parseInt(process.env.ACCESS_TOKEN_EXPIRY_SECONDS || '900') * 1000
    });

    return res.json({
      success: true,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Refresh error: ${error.message}`);
    return res.status(500).json({
      error: 'Internal Server Error',
      code: 'REFRESH_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get('/me', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      code: 'MISSING_TOKEN',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const user = await userRegistry.getUser(req.user.id);

    if (!user) {
      return res.status(404).json({
        error: 'User Not Found',
        code: 'USER_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }

    return res.json({
      success: true,
      user,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Get current user error: ${error.message}`);
    return res.status(500).json({
      error: 'Internal Server Error',
      code: 'GET_USER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
