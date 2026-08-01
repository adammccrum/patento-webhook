import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current week boundaries (Monday to Sunday)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust for Sunday
    const weekStart = new Date(today.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // People who solved a real problem this week (reflections submitted)
    const weeklyTransformations = await prisma.sessionMetrics.count({
      where: {
        reflectionSubmitted: true,
        completedAt: { gte: weekStart, lt: weekEnd },
      },
    });

    // Get last week for comparison
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(weekStart);

    const lastWeekTransformations = await prisma.sessionMetrics.count({
      where: {
        reflectionSubmitted: true,
        completedAt: { gte: lastWeekStart, lt: lastWeekEnd },
      },
    });

    // Calculate trend
    const weekOverWeekChange =
      lastWeekTransformations > 0
        ? ((weeklyTransformations - lastWeekTransformations) / lastWeekTransformations) * 100
        : 0;

    // Get daily breakdown for this week
    const dailyBreakdown = [];
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(weekStart);
      dayStart.setDate(dayStart.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const count = await prisma.sessionMetrics.count({
        where: {
          reflectionSubmitted: true,
          completedAt: { gte: dayStart, lt: dayEnd },
        },
      });

      dailyBreakdown.push({
        day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
        count,
      });
    }

    return NextResponse.json({
      weeklyTransformations,
      lastWeekTransformations,
      weekOverWeekChangePercent: Math.round(weekOverWeekChange * 10) / 10,
      dailyBreakdown,
    });
  } catch (error) {
    console.error('Error fetching weekly transformations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weekly transformations' },
      { status: 500 }
    );
  }
}
