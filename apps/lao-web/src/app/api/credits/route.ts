/**
 * LAO Credits API
 * Get user's credit usage and balance
 */

import { PrismaClient } from '@prisma/client';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

const prisma = new PrismaClient();

/**
 * GET /api/credits
 * Get user's credit details
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [credits, usageHistory] = await Promise.all([
      prisma.credits.findUnique({
        where: { userId },
        select: {
          balance: true,
          spent: true,
          monthlyReset: true,
          lastResetDate: true,
          updatedAt: true,
        },
      }),
      prisma.auditLog.findMany({
        where: {
          userId,
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
      return NextResponse.json(
        { error: 'Credits not found' },
        { status: 404 }
      );
    }

    const creditsRemaining = Math.max(0, (credits.monthlyReset || 0) - (credits.spent || 0));
    const percentUsed = credits.monthlyReset
      ? Math.round((credits.spent || 0) / credits.monthlyReset * 100)
      : 0;

    return NextResponse.json({
      balance: credits.balance,
      monthlyAllocation: credits.monthlyReset,
      spent: credits.spent,
      remaining: creditsRemaining,
      percentUsed,
      lastResetDate: credits.lastResetDate,
      updatedAt: credits.updatedAt,
      usageHistory,
    });
  } catch (error) {
    console.error('Credits fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credits' },
      { status: 500 }
    );
  }
}
