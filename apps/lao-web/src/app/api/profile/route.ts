/**
 * LAO Profile API
 * Get and update user profile
 * Uses IrisKey Platform infrastructure
 */

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, ApiResponseBuilder, authError, validationError, toResponse } from '@iriskey/middleware';
import { getAuditService } from '@iriskey/audit';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

// Reads the session from request headers, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  bio: z.string().max(500).optional(),
  avatar: z.string().url().optional(),
  timezone: z.string().optional(),
  language: z.string().length(2).optional(),
});

/**
 * GET /api/profile
 * Get user's profile
 */
export const GET = withErrorHandler(async (request: NextRequest, ctx) => {
  const session = await requireAuth();
  const userId = session.user?.id;

  if (!userId) {
    return authError();
  }

  const [user, profile] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        emailVerified: true,
        createdAt: true,
      },
    }),
    db.profile.findUnique({
      where: { userId },
    }),
  ]);

  if (!user) {
    return toResponse(
      ApiResponseBuilder.error('USER_NOT_FOUND', 'User not found'),
      404
    );
  }

  return toResponse(ApiResponseBuilder.success({ user, profile }), 200);
});

/**
 * PUT /api/profile
 * Update user's profile
 */
export const PUT = withErrorHandler(async (request: NextRequest, ctx) => {
  const session = await requireAuth();
  const userId = session.user?.id;

  if (!userId) {
    return authError();
  }

  const body = await request.json();
  const validation = updateProfileSchema.safeParse(body);

  if (!validation.success) {
    return validationError(validation.error.errors[0].message);
  }

  const { name, ...profileUpdates } = validation.data;

  const [updatedUser, updatedProfile] = await Promise.all([
    name
      ? db.user.update({
          where: { id: userId },
          data: { name },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            emailVerified: true,
          },
        })
      : db.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            emailVerified: true,
          },
        }),
    db.profile.update({
      where: { userId },
      data: profileUpdates,
    }),
  ]);

  const auditService = getAuditService();
  await auditService.logProfileUpdated(userId, ctx.productId, Object.keys(validation.data));

  return toResponse(
    ApiResponseBuilder.success({ user: updatedUser, profile: updatedProfile }),
    200
  );
});
