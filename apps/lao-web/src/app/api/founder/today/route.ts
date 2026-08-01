import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Reads the session from request headers, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // New learners today
    const newLearners = await prisma.user.count({
      where: {
        createdAt: { gte: today, lt: tomorrow },
      },
    });

    // Sessions started today
    const sessionsStarted = await prisma.analyticsEvent.count({
      where: {
        eventType: 'session_started',
        createdAt: { gte: today, lt: tomorrow },
      },
    });

    // Sessions completed today
    const sessionsCompleted = await prisma.analyticsEvent.count({
      where: {
        eventType: 'session_completed',
        createdAt: { gte: today, lt: tomorrow },
      },
    });

    // Problems solved today (reflections submitted)
    const problemsSolved = await prisma.sessionMetrics.count({
      where: {
        reflectionSubmitted: true,
        completedAt: { gte: today, lt: tomorrow },
      },
    });

    // Assets created today
    const assetsCreated = await prisma.asset.count({
      where: {
        createdAt: { gte: today, lt: tomorrow },
      },
    });

    // Average TTFT today
    const ttftData = await prisma.sessionMetrics.aggregate({
      where: {
        ttftMillis: { not: null },
        completedAt: { gte: today, lt: tomorrow },
      },
      _avg: { ttftMillis: true },
    });

    // Average TTC (detect from reflections with confidence language)
    const ttcData = await prisma.sessionMetrics.aggregate({
      where: {
        hasConfidenceLanguage: true,
        completedAt: { gte: today, lt: tomorrow },
      },
      _avg: { ttftMillis: true },
    });

    // Average confidence increase
    const confidenceData = await prisma.sessionMetrics.aggregate({
      where: {
        completedAt: { gte: today, lt: tomorrow },
      },
      _avg: {
        confidenceAfter: true,
        confidenceBefore: true,
      },
    });

    const avgConfidenceBefore = confidenceData._avg.confidenceBefore || 0.5;
    const avgConfidenceAfter = confidenceData._avg.confidenceAfter || 0.5;
    const confidenceIncrease = avgConfidenceAfter - avgConfidenceBefore;

    return NextResponse.json({
      newLearners,
      sessionsStarted,
      sessionsCompleted,
      problemsSolved,
      assetsCreated,
      avgTTFT: ttftData._avg.ttftMillis ? Math.round(ttftData._avg.ttftMillis / 1000) : 0,
      avgTTC: ttcData._avg.ttftMillis ? Math.round(ttcData._avg.ttftMillis / 1000) : 0,
      confidenceIncrease: Math.round(confidenceIncrease * 100) / 100,
    });
  } catch (error) {
    console.error('Error fetching today metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
