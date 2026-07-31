/**
 * LAO Credits API
 * Get user's credit usage and balance
 * Uses IrisKey Platform infrastructure
 */

import { type NextRequest } from 'next/server';
import { withErrorHandler, ApiResponseBuilder, authError, toResponse, notFoundError } from '@iriskey/middleware';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/credits
 * Get user's credit details
 */
export const GET = withErrorHandler(async (request: NextRequest, ctx) => {
  const session = await requireAuth();
  const userId = session.user?.id;

  if (!userId) {
    return authError();
  }

  const [credits, usageHistory] = await Promise.all([
    db.credits.findUnique({
      where: { userId },
      select: {
        balance: true,
        spent: true,
        monthlyReset: true,
        lastResetDate: true,
        updatedAt: true,
      },
    }),
    db.auditLog.findMany({
      where: {
        userId,
        productId: ctx.productId,
        action: {
          in: ['ai_usage', 'credits_purchased', 'credits_refunded'],
        },
      },
      select: {
        id: true,
        action: true,
        details: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  if (!credits) {
    return notFoundError('Credits');
  }

  const creditsRemaining = Math.max(0, (credits.monthlyReset || 0) - (credits.spent || 0));
  const percentUsed = credits.monthlyReset
    ? Math.round((credits.spent || 0) / credits.monthlyReset * 100)
    : 0;

  const creditsData = {
    balance: credits.balance,
    monthlyAllocation: credits.monthlyReset,
    spent: credits.spent,
    remaining: creditsRemaining,
    percentUsed,
    lastResetDate: credits.lastResetDate,
    updatedAt: credits.updatedAt,
    usageHistory,
  };

  return toResponse(ApiResponseBuilder.success(creditsData), 200);
});
