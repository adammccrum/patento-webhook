/**
 * Forgot password endpoint
 * Uses IrisKey Platform infrastructure
 */

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { generateVerificationToken } from '@iriskey/auth';
import { withErrorHandler, ApiResponseBuilder, validationError, toResponse } from '@iriskey/middleware';
import { getAuditService } from '@iriskey/audit';
import { db } from '@/lib/db';

const schema = z.object({
  email: z.string().email('Invalid email address'),
});

/**
 * POST /api/auth/forgot-password
 * Send password reset email
 */
export const POST = withErrorHandler(async (request: NextRequest, ctx) => {
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
  }

  return toResponse(
    ApiResponseBuilder.success({ message: 'If an account exists, a reset link has been sent' }),
    200
  );
});
