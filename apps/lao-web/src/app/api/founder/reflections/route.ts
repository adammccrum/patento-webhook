import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Get most recent reflections
    const reflections = await prisma.sessionMetrics.findMany({
      where: {
        reflectionSubmitted: true,
        reflection: { not: null },
      },
      select: {
        id: true,
        reflection: true,
        completedAt: true,
        userId: true,
        goalId: true,
        confidenceAfter: true,
        hasConfidenceLanguage: true,
      },
      orderBy: { completedAt: 'desc' },
      take: limit,
    });

    // Enrich with learner info
    const enriched = await Promise.all(
      reflections.map(async (r) => {
        const user = await prisma.user.findUnique({
          where: { id: r.userId },
          select: { email: true, name: true },
        });
        const goal = await prisma.learnerGoal.findUnique({
          where: { id: r.goalId || '' },
          select: { problem: true },
        });
        return {
          ...r,
          learnerEmail: user?.email || 'Unknown',
          learnerName: user?.name,
          problem: goal?.problem,
        };
      })
    );

    return NextResponse.json({ reflections: enriched });
  } catch (error) {
    console.error('Error fetching reflections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reflections' },
      { status: 500 }
    );
  }
}
