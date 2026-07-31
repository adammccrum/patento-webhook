/**
 * LAO Dashboard API
 * Provides user dashboard data
 */

import { PrismaClient } from '@prisma/client';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

const prisma = new PrismaClient();

/**
 * GET /api/dashboard
 * Get user's dashboard data
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user data in parallel
    const [user, profile, credits, settings, recentActivity] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          createdAt: true,
        },
      }),
      prisma.profile.findUnique({
        where: { userId },
        select: {
          bio: true,
          avatar: true,
          timezone: true,
          language: true,
          onboardingCompleted: true,
        },
      }),
      prisma.credits.findUnique({
        where: { userId },
        select: {
          balance: true,
          spent: true,
          monthlyReset: true,
          lastResetDate: true,
        },
      }),
      prisma.settings.findUnique({
        where: { userId },
        select: {
          twoFactorEnabled: true,
          emailNotifications: true,
          darkMode: true,
        },
      }),
      prisma.auditLog.findMany({
        where: { userId },
        select: {
          id: true,
          action: true,
          resource: true,
          details: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const dashboardData = {
      user,
      profile,
      credits: {
        ...credits,
        creditsUsedThisMonth: credits?.spent || 0,
        creditsRemaining: Math.max(0, (credits?.monthlyReset || 0) - (credits?.spent || 0)),
      },
      settings,
      recentActivity,
      stats: {
        accountAge: Math.floor(
          (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        ),
        isOnboarded: profile?.onboardingCompleted || false,
      },
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
