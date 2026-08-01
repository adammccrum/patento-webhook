// PUBLIC ROUTE — deliberately requires no capability. See the authorization
// coverage test, which fails if a route is neither capability-gated nor listed.
/**
 * Forgot password endpoint
 * Uses IrisKey Platform infrastructure
 */

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { generateVerificationToken } from '@iriskey/auth';
import { withErrorHandler, ApiResponseBuilder, validationError, toResponse } from '@iriskey/middleware';
import { getAuditService } from '@iriskey/audit';
import { getRateLimitStore, RateLimitPresets } from '@iriskey/ratelimit';
import { getLogger } from '@iriskey/monitoring';
import { db } from '@/lib/db';
import { sendPasswordReset } from '@/lib/email';

const schema = z.object({
  email: z.string().email('Invalid email address'),
});

/**
 * POST /api/auth/forgot-password
 * Send password reset email
 */
export const POST = withErrorHandler(async (request: NextRequest, ctx) => {
  const logger = getLogger();
  const rateLimitStore = getRateLimitStore();

  // Apply rate limiting. checkLimit compares against the preset's maxRequests;
  // the raw limiter's `success` is always true and would never block.
  const rateLimitResult = await rateLimitStore.checkLimit(
    'passwordReset',
    ctx.ipAddress ?? 'unknown',
    RateLimitPresets.passwordReset
  );

  if (rateLimitResult.limited) {
    logger.warn('Password reset rate limit exceeded', {
      context: {
        ipAddress: ctx.ipAddress,
        limit: rateLimitResult.limit,
        current: rateLimitResult.current,
      },
    });
    return toResponse(
      ApiResponseBuilder.error('RATE_LIMIT_EXCEEDED', 'Too many password reset attempts. Please try again later.', {
        retryAfter: rateLimitResult.retryAfter,
      }),
      429
    );
  }

  const body = await request.json();

  const validation = schema.safeParse(body);
  if (!validation.success) {
    return validationError(validation.error.errors[0].message);
  }

  const { email } = validation.data;

  const user = await db.user.findUnique({
    where: { email },
  });

  // Don't reveal if email exists (security best practice)
  if (user) {
    const resetToken = generateVerificationToken();

    await db.verificationToken.create({
      data: {
        identifier: email,
        token: resetToken,
        type: 'password-reset',
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const auditService = getAuditService();
    await auditService.logPasswordReset(user.id, ctx.productId);

    // Deliver it. A failure here must not tell the caller whether the
    // address exists, so it is logged and swallowed.
    try {
      await sendPasswordReset(email, resetToken);
    } catch (error) {
      logger.error(
        'Password reset email failed to send',
        error instanceof Error ? error : new Error(String(error)),
        { userId: user.id, productId: ctx.productId }
      );
    }

    logger.info('Password reset requested', {
      context: {
        userId: user.id,
        email,
        productId: ctx.productId,
      },
    });
  }

  return toResponse(
    ApiResponseBuilder.success({ message: 'If an account exists, a reset link has been sent' }),
    200
  );
});
