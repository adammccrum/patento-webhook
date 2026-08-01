import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

interface FunnelStage {
  stage: string;
  count: number;
  conversionFromPrevious: number;
  averageTimeSeconds: number;
  abandonmentPercent: number;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Stage 1: Landing (session_started)
    const landing = await prisma.analyticsEvent.count({
      where: { eventType: 'session_started' },
    });

    // Stage 2: Discover (discover_completed)
    const discover = await prisma.analyticsEvent.count({
      where: { eventType: 'discover_completed' },
    });

    // Stage 3: Personal Plan (build_session_started)
    const personalPlan = await prisma.analyticsEvent.count({
      where: { eventType: 'build_session_started' },
    });

    // Stage 4: Build (asset_created)
    const build = await prisma.asset.count();

    // Stage 5: Reflection (reflection_submitted)
    const reflection = await prisma.sessionMetrics.count({
      where: { reflectionSubmitted: true },
    });

    // Calculate conversion percentages and abandonment
    const funnel: FunnelStage[] = [
      {
        stage: 'Landing',
        count: landing,
        conversionFromPrevious: 100,
        averageTimeSeconds: 0,
        abandonmentPercent: ((landing - discover) / landing * 100) || 0,
      },
      {
        stage: 'Discover',
        count: discover,
        conversionFromPrevious: landing > 0 ? (discover / landing * 100) : 0,
        averageTimeSeconds: 60,
        abandonmentPercent: ((discover - personalPlan) / discover * 100) || 0,
      },
      {
        stage: 'Personal Plan',
        count: personalPlan,
        conversionFromPrevious: discover > 0 ? (personalPlan / discover * 100) : 0,
        averageTimeSeconds: 45,
        abandonmentPercent: ((personalPlan - build) / personalPlan * 100) || 0,
      },
      {
        stage: 'Build',
        count: build,
        conversionFromPrevious: personalPlan > 0 ? (build / personalPlan * 100) : 0,
        averageTimeSeconds: 1200,
        abandonmentPercent: ((build - reflection) / build * 100) || 0,
      },
      {
        stage: 'Reflection',
        count: reflection,
        conversionFromPrevious: build > 0 ? (reflection / build * 100) : 0,
        averageTimeSeconds: 120,
        abandonmentPercent: 0,
      },
    ];

    return NextResponse.json({ funnel });
  } catch (error) {
    console.error('Error fetching funnel:', error);
    return NextResponse.json(
      { error: 'Failed to fetch funnel data' },
      { status: 500 }
    );
  }
}
