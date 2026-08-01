import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Reads the session from request headers, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

interface FrictionIssue {
  type: string;
  metric: string;
  value: number | string;
  recommendation: string;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const issues: FrictionIssue[] = [];

    // 1. Slowest TTFT (outliers - sessions taking much longer than average)
    const slowestTTFT = await prisma.sessionMetrics.aggregate({
      where: { ttftMillis: { not: null } },
      _max: { ttftMillis: true },
      _avg: { ttftMillis: true },
    });

    if (
      slowestTTFT._max.ttftMillis &&
      slowestTTFT._avg.ttftMillis &&
      slowestTTFT._max.ttftMillis > slowestTTFT._avg.ttftMillis * 2
    ) {
      issues.push({
        type: 'Slowest TTFT',
        metric: `${Math.round(slowestTTFT._max.ttftMillis / 1000)}s max (${Math.round(slowestTTFT._avg.ttftMillis / 1000)}s avg)`,
        value: slowestTTFT._max.ttftMillis,
        recommendation: 'Investigate what causes some learners to take 2x longer. Check build page friction.',
      });
    }

    // 2. Lowest confidence increase
    const lowestConfidence = await prisma.sessionMetrics.findFirst({
      where: {
        completedAt: { not: null },
        confidenceBefore: { not: null },
        confidenceAfter: { not: null },
      },
      select: {
        id: true,
        confidenceBefore: true,
        confidenceAfter: true,
      },
      orderBy: {
        confidenceAfter: 'asc',
      },
    });

    if (lowestConfidence && lowestConfidence.confidenceAfter) {
      const increase =
        (lowestConfidence.confidenceAfter - (lowestConfidence.confidenceBefore || 0)) *
        100;
      if (increase < 10) {
        issues.push({
          type: 'Weakest Confidence Gain',
          metric: `${Math.round(increase)}% increase`,
          value: increase,
          recommendation:
            'Some learners finish without feeling confident. Review reflection prompts and build guidance.',
        });
      }
    }

    // 3. Biggest abandonment point
    const landing = await prisma.analyticsEvent.count({
      where: { eventType: 'session_started' },
    });
    const discover = await prisma.analyticsEvent.count({
      where: { eventType: 'discover_completed' },
    });
    const build = await prisma.asset.count();

    const discoverAbandonment = ((landing - discover) / landing) * 100 || 0;
    const buildAbandonment = ((discover - build) / discover) * 100 || 0;

    if (discoverAbandonment > 20) {
      issues.push({
        type: 'Biggest Abandonment Point',
        metric: `${Math.round(discoverAbandonment)}% at Discover stage`,
        value: discoverAbandonment,
        recommendation:
          'Learners are dropping off at problem definition. Simplify the Discover flow.',
      });
    } else if (buildAbandonment > 20) {
      issues.push({
        type: 'Biggest Abandonment Point',
        metric: `${Math.round(buildAbandonment)}% at Build stage`,
        value: buildAbandonment,
        recommendation:
          'Learners are abandoning during build. The build steps are too complex or unclear.',
      });
    }

    // 4. Incomplete sessions (started but not completed)
    const started = await prisma.analyticsEvent.count({
      where: { eventType: 'session_started' },
    });
    const completed = await prisma.analyticsEvent.count({
      where: { eventType: 'session_completed' },
    });
    const incompleteRate = ((started - completed) / started) * 100 || 0;

    if (incompleteRate > 30) {
      issues.push({
        type: 'High Incomplete Rate',
        metric: `${Math.round(incompleteRate)}% sessions incomplete`,
        value: incompleteRate,
        recommendation:
          'Over 30% of sessions do not complete. Investigate where learners get stuck.',
      });
    }

    // 5. Low completion confidence
    const completedSessions = await prisma.sessionMetrics.aggregate({
      where: { completedAt: { not: null } },
      _avg: { confidenceAfter: true },
    });

    if ((completedSessions._avg.confidenceAfter || 0) < 0.6) {
      issues.push({
        type: 'Low Post-Completion Confidence',
        metric: `${Math.round((completedSessions._avg.confidenceAfter || 0) * 100)}% confidence`,
        value: completedSessions._avg.confidenceAfter || 0,
        recommendation:
          'Learners finish but lack confidence in using their built tool. Improve the reflection experience.',
      });
    }

    return NextResponse.json({ friction: issues.slice(0, 5) });
  } catch (error) {
    console.error('Error fetching friction data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch friction data' },
      { status: 500 }
    );
  }
}
