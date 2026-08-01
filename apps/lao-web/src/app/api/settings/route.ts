/**
 * LAO Settings API
 * Get and update user settings
 * Uses IrisKey Platform infrastructure
 */

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, ApiResponseBuilder, authError, validationError, toResponse, notFoundError } from '@iriskey/middleware';
import { getAuditService } from '@iriskey/audit';
import { requireCapability } from '@/lib/authorization';
import { db } from '@/lib/db';

// Reads the session from request headers, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

const updateSettingsSchema = z.object({
  twoFactorEnabled: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  darkMode: z.boolean().optional(),
  emailOnLogin: z.boolean().optional(),
  emailOnSecurityAlert: z.boolean().optional(),
});

/**
 * GET /api/settings
 * Get user's settings
 */
export const GET = withErrorHandler(async (request: NextRequest, ctx) => {
  const principal = await requireCapability('account.read');
  const userId = principal.userId;

  if (!userId) {
    return authError();
  }

  const settings = await db.settings.findUnique({
    where: { userId },
  });

  if (!settings) {
    return notFoundError('Settings');
  }

  return toResponse(ApiResponseBuilder.success(settings), 200);
});

/**
 * PUT /api/settings
 * Update user's settings
 */
export const PUT = withErrorHandler(async (request: NextRequest, ctx) => {
  const principal = await requireCapability('account.write');
  const userId = principal.userId;

  if (!userId) {
    return authError();
  }

  const body = await request.json();
  const validation = updateSettingsSchema.safeParse(body);

  if (!validation.success) {
    return validationError(validation.error.errors[0].message);
  }

  const updatedSettings = await db.settings.update({
    where: { userId },
    data: validation.data,
  });

  const auditService = getAuditService();
  await auditService.logSettingsUpdated(userId, ctx.productId, Object.keys(validation.data));

  return toResponse(ApiResponseBuilder.success(updatedSettings), 200);
});
