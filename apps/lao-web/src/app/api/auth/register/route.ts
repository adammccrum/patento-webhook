// PUBLIC ROUTE — deliberately requires no capability. See the authorization
// coverage test, which fails if a route is neither capability-gated nor listed.
/**
 * LAO User registration endpoint
 * Uses IrisKey Platform infrastructure
 */

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { hashPassword, generateVerificationToken } from '@iriskey/auth';
import { getProductId } from '@iriskey/config';
import { withErrorHandler, ApiResponseBuilder, validationError, ApiErrorResponse, toResponse } from '@iriskey/middleware';
import { getAuditService } from '@iriskey/audit';
import { getRateLimitStore, RateLimitPresets } from '@iriskey/ratelimit';
import { getLogger } from '@iriskey/monitoring';
import { db } from '@/lib/db';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * POST /api/auth/register
 * Register a new user
 */
export const POST = withErrorHandler(async (request: NextRequest, ctx) => {
  const logger = getLogger();
  const rateLimitStore = getRateLimitStore();

  // Apply rate limiting. checkLimit compares against the preset's maxRequests;
  // the raw limiter's `success` is always true and would never block.
  const rateLimitResult = await rateLimitStore.checkLimit(
    'registration',
    ctx.ipAddress ?? 'unknown',
    RateLimitPresets.registration
  );

  if (rateLimitResult.limited) {
    logger.warn('Registration rate limit exceeded', {
      context: {
        ipAddress: ctx.ipAddress,
        limit: rateLimitResult.limit,
        current: rateLimitResult.current,
      },
    });
    return toResponse(
      ApiResponseBuilder.error('RATE_LIMIT_EXCEEDED', 'Too many registration attempts. Please try again later.', {
        retryAfter: rateLimitResult.retryAfter,
      }),
      429
    );
  }

  const body = await request.json();

  const validation = registerSchema.safeParse(body);
  if (!validation.success) {
    return validationError(validation.error.errors[0].message);
  }

  const { name, email, password } = validation.data;

  const existingUser = await db.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new ApiErrorResponse('EMAIL_ALREADY_EXISTS', 'Email already registered', 409);
  }

  const hashedPassword = await hashPassword(password);

  const user = await db.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      profile: {
        create: {},
      },
      credits: {
        create: {
          balance: 1000,
          monthlyReset: 1000,
        },
      },
      settings: {
        create: {},
      },
    },
  });

  const verificationToken = generateVerificationToken();

  await db.verificationToken.create({
    data: {
      identifier: email,
      token: verificationToken,
      type: 'email-verify',
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  // Use audit service instead of manual logging
  const auditService = getAuditService();
  await auditService.logUserRegistered(user.id, email, ctx.productId, ctx.ipAddress);

  logger.info('User registered successfully', {
    context: {
      userId: user.id,
      email,
      productId: ctx.productId,
    },
  });

  return toResponse(
    ApiResponseBuilder.success(
      {
        message: 'Registration successful. Please verify your email.',
        userId: user.id,
      },
      { registered: true }
    ),
    201
  );
});
