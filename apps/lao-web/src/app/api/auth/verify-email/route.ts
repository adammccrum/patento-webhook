// PUBLIC ROUTE — deliberately requires no capability. See the authorization
// coverage test, which fails if a route is neither capability-gated nor listed.
/**
 * Email verification endpoint
 * Uses IrisKey Platform infrastructure
 */

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { getProductId } from '@iriskey/config';
import { withErrorHandler, ApiResponseBuilder, validationError, ApiErrorResponse, toResponse, notFoundError } from '@iriskey/middleware';
import { getAuditService } from '@iriskey/audit';
import { db } from '@/lib/db';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  token: z.string().min(1, 'Token is required'),
});

/**
 * POST /api/auth/verify-email
 * Verify email with token
 */
export const POST = withErrorHandler(async (request: NextRequest, ctx) => {
  const body = await request.json();

  const validation = schema.safeParse(body);
  if (!validation.success) {
    return validationError(validation.error.errors[0].message);
  }

  const { email, token } = validation.data;

  const verificationToken = await db.verificationToken.findUnique({
    where: {
      identifier_token: {
        identifier: email,
        token,
      },
    },
  });

  if (!verificationToken) {
    throw new ApiErrorResponse('INVALID_TOKEN', 'Invalid or expired verification token', 400);
  }

  if (verificationToken.expires < new Date()) {
    await db.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: email,
          token,
        },
      },
    });

    throw new ApiErrorResponse('TOKEN_EXPIRED', 'Verification token has expired', 400);
  }

  const user = await db.user.findUnique({
    where: { email },
  });

  if (!user) {
    return notFoundError('User');
  }

  await db.user.update({
    where: { id: user.id },
    data: { emailVerified: new Date() },
  });

  await db.verificationToken.delete({
    where: {
      identifier_token: {
        identifier: email,
        token,
      },
    },
  });

  const auditService = getAuditService();
  await auditService.logEmailVerified(user.id, email, ctx.productId);

  return toResponse(ApiResponseBuilder.success({ message: 'Email verified successfully' }), 200);
});
