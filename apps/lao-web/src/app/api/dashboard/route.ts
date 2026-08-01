/**
 * LAO Dashboard API
 * Provides user dashboard data
 * Uses IrisKey Platform infrastructure
 */

import { type NextRequest } from 'next/server';
import { withErrorHandler, ApiResponseBuilder, authError, toResponse } from '@iriskey/middleware';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/dashboard
 * Get user's dashboard data
 */
export const GET = withErrorHandler(async (request: NextRequest, ctx) => {
  const session = await requireAuth();
  const userId = session.user?.id;

  if (!userId) {
    return authError();
  }

  // Fetch user data in parallel
  const [user, profile, credits, settings, recentActivity, portfolio, learnerState, solutions] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        createdAt: true,
      },
    }),
    db.profile.findUnique({
      where: { userId },
      select: {
        bio: true,
        avatar: true,
        timezone: true,
        language: true,
        onboardingCompleted: true,
      },
    }),
    db.credits.findUnique({
      where: { userId },
      select: {
        balance: true,
        spent: true,
        monthlyReset: true,
        lastResetDate: true,
      },
    }),
    db.settings.findUnique({
      where: { userId },
      select: {
        twoFactorEnabled: true,
        emailNotifications: true,
        darkMode: true,
      },
    }),
    db.auditLog.findMany({
      where: { userId, productId: ctx.productId },
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
    db.portfolio.findMany({
      where: { userId },
      select: {
        id: true,
        problemSolved: true,
        solutionCreated: true,
        reflection: true,
        status: true,
        missionCompletedAt: true,
      },
      orderBy: { missionCompletedAt: 'desc' },
      take: 10,
    }),
    db.learnerState.findUnique({
      where: { userId },
      select: {
        overallConfidence: true,
        problemsSolved: true,
        predictedReturnDate: true,
      },
    }),
    // The toolbox — what the learner actually opens LAO to use.
    db.solution.findMany({
      where: { userId, status: 'active' },
      select: {
        id: true,
        name: true,
        problem: true,
        problemArea: true,
        currentVersion: true,
        useCount: true,
        lastUsedAt: true,
        timeSavedMinutes: true,
        totalTimeSavedMinutes: true,
      },
      orderBy: [{ lastUsedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    }),
  ]);

  if (!user) {
    return toResponse(
      ApiResponseBuilder.error('USER_NOT_FOUND', 'User not found'),
      404
    );
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
    portfolio: portfolio || [],
    learnerState: learnerState || {
      overallConfidence: 0.5,
      problemsSolved: 0,
      predictedReturnDate: null,
    },
    solutions: solutions || [],
    toolbox: {
      total: solutions.length,
      inUse: solutions.filter((s) => s.useCount > 0).length,
      weeklyTimeSaved: solutions.reduce(
        (total, s) => total + (s.useCount > 0 ? s.timeSavedMinutes : 0),
        0
      ),
    },
    stats: {
      accountAge: Math.floor(
        (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      ),
      isOnboarded: profile?.onboardingCompleted || false,
    },
  };

  return toResponse(ApiResponseBuilder.success(dashboardData), 200);
});
